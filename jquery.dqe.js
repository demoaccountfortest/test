(function ($) {

    /**
     * Version 1.0
     *
     *  ---------COMPATIBILITY--------------
     * |  2.1.4  <=   jquery    <= 3.4.1    |
     * |  1.8.16 <=   jquery-ui <=  1.12.1  |
     * ------------------------------------
     * Appelle le service DQE Address à partir d'une FORM ou d'une DIV contenant les champs
     * Options disponibles :
     *   - server: URL du serveur ou - pour des appels directs - 'jsonp' ou 'cors'
     *   - license: code licence. Uniquement pour des appels directs jsonp ou CORS
     *   - city: sélecteur jQuery pointant sur le champ ville
     *   - zip: sélecteur jQuery pointant sur le champ code postal
     *   - zipcity: sélecteur jQuery pointant sur le champ code postal+ville (en remplacement des champs zip et city)
     *
     * Evènements disponibles :
     *   - zip(event, zip): se déclenche quand un code postal est validé
     *   - city(event, city_id, city_name): se déclenche quand une ville est choisie
     *
     * @param {object} options Tableau associatif des options
     * @returns {jQuery}
     */
    $.fn.dqe = function (options) {
        var myDQE = this;

        //Expressions régulières permettant de tester si un code postal a été complètement saisi pour lancer la recherche de villes
        myDQE.zip_pattern = {
            'FRA': /^\d{5}$/,
        };

        //Decode les caractères particuliers retournés en unicode
        myDQE.udecode = function (s) {
            if (s.indexOf('\\\\u') == -1) return s;
            var regex = /\\\\u([\d\w]{4})/gi;
            s = s.replace(regex, function (match, grp) {
                return String.fromCharCode(parseInt(grp, 16));
            });
            return s;
        };

        //Chargement des paramètres
        var settings = $.extend({
            //Paramètres par défaut
            country: "FRA",
            trace: 0,
            license: 'I6wvrH0QvN47j3LzpNwVY~H14t',
            append_locality: 0 //On concatène le lieu-dit d'adresse au bout de la ville
        }, options);
        myDQE.settings = settings;

        //On récupère les champs à partir de leur selecteur
        myDQE.server = settings.server;
        myDQE.license = settings.license; //obligatoire si jsonp ou cors
        //champs autocomplétés
        myDQE.city = settings.city ? $(settings.city) : false;
        myDQE.zip = settings.zip ? $(settings.zip) : false;
        myDQE.zipcity = settings.zipcity ? $(settings.zipcity) : false; //CP et Ville regroupés

        myDQE.asmx = myDQE.server.toLowerCase().indexOf(".asmx") > -1;

        //Paramètres AJAX
        if (myDQE.server === 'jsonp') {
            myDQE.ajax = function (url, callback) {
                $.ajax({
                    url: url,
                    dataType: 'jsonp',
                    jsonp: 'callback',
                    error: function (xhr, status, error) {
                        console.log('DQE Address : An error occured.')
                    },
                    success: function (data) {
                        if (!data) data = "{}";
                        try {
                            callback(JSON.parse(data));
                        } catch (error) {
                            console.log('The response has an invalid JSON format.');
                        }
                    }
                });
            };
        }

        myDQE.render_item = function (ul, item) {
            var highlighted;
            var term = this.term;
            if (term.indexOf(" ") > -1) {
                var terms = term.split(" ");
                var len = terms.length;
                highlighted = item.label;
                for (var i = 0; i < len; i++)
                    highlighted = highlight_term(highlighted, terms[i]);
            }
            else highlighted = highlight_term(item.label, this.term);
            highlighted = string_replace(highlighted, '{', '<strong>');
            highlighted = string_replace(highlighted, '}', '</strong>');
            highlighted = string_replace(highlighted, '|', '<br/><span style="color:#070">') + '</span>';
            highlighted = string_replace(highlighted, '[', '<span class="ko">');
            highlighted = string_replace(highlighted, ']', '</span>');
            return $("<li></li>")
                .data("item.autocomplete", item)
                .append("<div>" + highlighted + "</div>")
                .appendTo(ul);
        };

        function string_replace(string, text, by) {
            string = string + "";
            var result = "";
            var slen = string.length;
            var len = text.length;
            var pos = string.indexOf(text);
            while (pos > -1) {
                result += string.substring(0, pos) + by;
                string = string.substring(pos + len, slen);
                pos = string.indexOf(text);
            }
            if (string != "") result += string;
            return result;
        }

        function highlight_term(source, term) {
            if (!term || !source) return source;
            var simple_source = myDQE.remove_accents(source).toLowerCase();
            var simple_term = myDQE.remove_accents(term).toLowerCase();
            var result = "";
            var len = term.length;
            var pos = simple_source.indexOf(simple_term);
            while (pos > -1) {
                result += source.substr(0, pos) + '{' + source.substr(pos, len) + '}';
                source = source.substr(pos + len);
                simple_source = simple_source.substr(pos + len);
                pos = simple_source.indexOf(simple_term);
            }
            if (source != "") result += source;
            return result;
        }

        myDQE.execute_trigger = function (field, value) {
            myDQE.trigger(field, value);
            if (field === "zip") {
                if (myDQE.zip) myDQE.selected_zip_value = myDQE.zip.val();
                if (myDQE.zipcity) myDQE.selected_zipcity_value = myDQE.zipcity.val();
            }
            if (field === "city") {
                if (myDQE.city) myDQE.selected_city_value = myDQE.city.val();
                if (myDQE.zipcity) myDQE.selected_zipcity_value = myDQE.zipcity.val();
            }
        };

        myDQE.count = function (t) {
            var cnt = 0;
            for (var key in t) {
                if (!t.hasOwnProperty(key)) continue;
                cnt++
            }
            return cnt;
        };

        myDQE.trimLeft = function (s, charlist) {
            if (!s) return '';
            if (charlist === undefined)
                return s.replace(/^\s+/gm, '');

            return s.replace(new RegExp("^[" + charlist + "]+"), "");
        };

        myDQE.trimRight = function (s, charlist) {
            if (!s) return '';
            if (charlist === undefined)
                return s.replace(/\s+$/gm, '');

            return s.replace(new RegExp("[" + charlist + "]+$"), "");
        };

        myDQE.trim = function (s, charlist) {
            if (!s) return '';
            if (charlist === undefined)
                return s.replace(/^\s+|\s+$/gm, '');

            s = myDQE.trimLeft(s, charlist);
            s = myDQE.trimRight(s, charlist);
            return s;
        };

        if (!Array.prototype.indexOf) {
            Array.prototype.indexOf = function (searchElement, fromIndex) {
                var k;
                if (this == null) throw new TypeError('"this" vaut null ou n est pas défini');
                var O = Object(this);
                var len = O.length >>> 0;
                if (len === 0) return -1;
                var n = +fromIndex || 0;

                if (Math.abs(n) === Infinity) n = 0;
                if (n >= len) return -1;
                k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);

                while (k < len) {
                    if (k in O && O[k] === searchElement) return k;
                    k++;
                }
                return -1;
            };
        }

        myDQE.filter_cities = function (result) {
            var i = 1;
            var cities = [];
            var result_count = myDQE.count(result);
            var name, lieudit, province, returned_zip, len_zip, company, city, voie, voies, id, label, zip;
            var country = myDQE.country;
            var bp = false;
            while (result[i]) {
                id = result[i]['IDLocalite'];
                if (!id && result_count === 1) return [];

                name = myDQE.trim(result[i]["Localite"]);
                lieudit = myDQE.trim(result[i]["LieuDit"]);
                province = myDQE.trim(result[i]["Province"]);
                if (province === name || !myDQE.trim(province, '*-')) province = '';

                if (country !== 'FRA' && province) {
                    var p = province.indexOf("-");
                    if (p > -1) {
                        province = province.substr(0, p);
                        p = id.indexOf("-");
                        if (p > -1) id = id.substr(0, p);
                    }
                }

                returned_zip = myDQE.trim(result[i]["CodePostal"]);

                if (returned_zip && name) {
                    len_zip = returned_zip.length - name.length - 1;
                    if (returned_zip.substr(len_zip) === ' ' + name) returned_zip = returned_zip.substr(0, len_zip);
                }

                company = result[i]['Entreprise'] ? myDQE.trim(result[i]['Entreprise']) : '';

                if (province) label = name + ", " + province;
                else label = lieudit ? returned_zip + ' ' + name + ", " + lieudit : returned_zip + ' ' + name;

                city = {'city_id': id, 'city': name};
                voie = result[i]['Voie'] ? result[i]['Voie'] : '';
                if (voie.indexOf('_BP_') > -1) bp = true;
                voies = voie ? voie.split(',') : [];

                for (var k = 0; k < voies.length; k++) {
                    voies[k] = myDQE.trim(voies[k]);
                }

                if (company) city['company'] = company;

                var zip_complements = [];

                    if (!myDQE.zip_pattern.hasOwnProperty('FRA') && myDQE.zip.val() != returned_zip) {
                        zip_complements.push(returned_zip);
                    }
                

                if (voies.length == 3) {

                    if (voies[0] && voies[1]) {
                        //Société avec 2 noms (courant au royaume uni)
                        city['company'] = voies[0] + ", " + voies[1];
                        zip_complements.push(city['company']);
                    }
                    else {
                        //Societe,complément,voie
                        if (voies[0]) {
                            city['company'] = voies[0];
                            zip_complements.push(voies[0]);
                        }
                        if (voies[1]) {
                            city['compl'] = voies[1];
                            zip_complements.push(voies[1]);
                        }
                    }
                    if (voies[2]) {
                        city['street'] = voies[2];
                        zip_complements.push(voies[2]);
                    }
                }
                else {
                    if (city['company']) zip_complements.push(city['company']);
                    if (voie) {
                        //Parfois le code postal seul nous permet de renseigner la rue
                        city['street'] = myDQE.trim(voie);
                        city['number'] = myDQE.trim(result[i]["Numero"]);
                        city['street_id'] = myDQE.trim(result[i]['IDVoie']);
                        zip_complements.push(city['street']);
                    }
                }

                if (zip_complements.length > 0) {
                    label += " (" + zip_complements.join(', ') + ")";
                }

                city['label'] = label;
                if (zip) city['zipcity'] = zip;
                if (returned_zip) city['zip'] = returned_zip;
                if (lieudit) city['local'] = lieudit;
                if (province) city['prov'] = province;
                if (result[i]['ListeNumero']) city['numbers'] = result[i]['ListeNumero'].split(';'); //Liste de boites postales retournées pour un CP précis (comme en Suède)
                city['zipcity'] = name.indexOf('(') === -1 ? returned_zip + ' ' + name : name;

                //Si mode sans CEDEX et localité trouvée est un CEDEX, on l'ignore.
                if (myDQE.cedex) {
                    cities.push(city);
                }
                else {
                    if ((String(name).indexOf('CEDEX') == -1)) {
                        cities.push(city);
                    }
                }

                i++;
            }
            return cities;
        };

        myDQE.filter_adr = function (result) {
            var i = 1;
            var streets = [];
            var adr, street, number, nums, zip, city, id, city_id, lieudit, label1, label2, line, label_compl, prov;
            var company = "";
            var nia = myDQE.num_is_after();
            while (result[i]) {
                adr = result[i];
                street = myDQE.trim(adr["Voie"]);
                number = myDQE.trim(adr["Numero"]);
                prov = "";

                if (adr['ListeNumero']) {
                    nums = adr['ListeNumero'].split(';');
                    if (nums.indexOf(number) === -1) number = '';
                }
                else nums = [];

                zip = myDQE.trim(adr['CodePostal']);
                city = myDQE.trim(adr['Localite']);
                id = myDQE.trim(adr['IDVoie']);
                city_id = myDQE.trim(adr['IDLocalite']);
                lieudit = adr["LieuDit"] ? myDQE.trim(result[i]["LieuDit"]) : '';

                //Avec 2 virgules dans la rue : société et/ou segment de ville a été renvoyé en plus de la voie
                var p = street.indexOf(",");
                if (p > -1) {
                    var parts = street.split(",");
                    if (parts.length === 3) {
                        company = myDQE.trim(parts[0]);
                        prov = myDQE.trim(parts[1]);
                        street = myDQE.trim(parts[2]);
                    }
                }

                label1 = nia ? myDQE.trim(street + ' ' + number) : myDQE.trim(number + ' ' + street);
                label_compl = (company ? ", " + company : "") + (prov ? ", " + prov : "") + (lieudit ? ", " + lieudit : "");
                label2 = zip ? label1 + " (" + zip + label_compl + ")" : label1 + label_compl;

                if (result[i]['Entreprise']) label2 += " (" + result[i]['Entreprise'] + ")";

                line = {
                    'id': id,
                    'label': label2,
                    'simple_label': label1,
                    'street': street,
                    'number': number,
                    'list_numbers': nums,
                    'zip': zip,
                    'city': city,
                    'city_id': city_id,
                    'local': lieudit,
                    'company': company
                };
                if (prov) line["prov"] = prov;
                if (company) line["company"] = company;

                streets.push(line);
                i++;
            }
            return streets;
        };

        myDQE.filter_num = function (result) {
            var list = result && result['1'] && result['1']['ListeNumero'] ? result['1']['ListeNumero'].split(';') : [];
            var numbers = [];
            var len = list.length;
            for (var i = 0; i < len; i++) {
                numbers.push({value: list[i], label: list[i]});
            }
            return numbers;
        };

        myDQE.filter_single = function (result) {
            if (!result || result === "{}") return [];
            var addresses = [];
            var i = 1;
            var line, street, len, label, address;
            var nia = myDQE.num_is_after();
            while (result[i]) {
                line = result[i];
                //ajout du filtre des cedex en single
                if (!myDQE.cedex && line['Localite'].indexOf('CEDEX') !== -1) {
                    i++; continue;
                }

                line['Numero'] = myDQE.trim(line['Numero']);
                if (line['Voie'].indexOf(',') > -1) {
                    street = line['Voie'].split(',');
                    len = street.length;
                    line['Voie'] = myDQE.trim(street[len - 1]);
                }
                else line['Voie'] = myDQE.trim(line['Voie']);

                list_numbers = line['ListeNumero'].split(';');
                number = list_numbers.includes(line['Numero']) ? line['Numero'] : '[' + line['Numero'] + ']';
                label = myDQE.recombine_street(number, line['TypeVoie'], line['Voie'], nia);
                label += ' | ' + myDQE.trim(line['CodePostal'] + ' ' + line['Localite']);
                if (line['Entreprise'] && line['Entreprise'] !== "") {
                    label += " (" + line['Entreprise'] + ")";
                }
                else {
                    if (line['LieuDit'] && line['LieuDit'] !== ""){
                        label += " (" + line['LieuDit'] + ")";
                    }
                }
                label = myDQE.trim(label);

                address = {
                    street: line['Voie'],
                    num: line['Numero'],
                    numonly: line['NumSeul'],
                    type: line['TypeVoie'],
                    id: line['IDVoie'],
                    zip: line['CodePostal'],
                    city: line['Localite'],
                    label: label,
                    value: label,
                    region1: line['Region1'],
                    region2: line['Region2'],
                    region3: line['Region3'],
                    region4: line['Region4'],
                    city_id: line['IDLocalite']
                };

                if (line["complement"]) address["numcompl"] = line["complement"];

                if (line['Entreprise']) address['company'] = line['Entreprise'];
                if (line['LieuDit']) address['local'] = line['LieuDit'];
                if (line['Complement']) address['compl'] = line['Complement'];
                if (line['Province'] && line['Province'] !== '*') address['prov'] = line['Province'];
                if (line['SousLocalite']) address['subcity'] = line['SousLocalite'];
                if (line['ListeNumero']) {
                    var nums = line['ListeNumero'].split(';');
                    var missing = !line['Numero'];
                    var wrong = nums.indexOf(line['Numero']) === -1;
                    if (missing) address['missing_number'] = 1;
                    if (wrong) address['wrong_number'] = 1;
                    if (missing || wrong) address['nums'] = nums;
                }
                else {
                    //La liste des numéros est vide. Si on a un numéro saisi, il est vraisemblablement incorrect
                    if (line['Numero']) address['unexpected_number'] = 1;
                }
                if (line['Latitude']) address['latitude'] = line['Latitude'];
                if (line['Longitude']) address['longitude'] = line['Longitude'];

                addresses.push(address);
                i++;
            }
            return addresses;
        };


        myDQE.fill_zip = function (zip) {
            myDQE.execute_trigger('zip', [zip]);
            if (myDQE.zip) myDQE.zip.val(zip);
        };

        myDQE.clear = function () {
            myDQE.clearSection('zip');
            if (myDQE.zip) myDQE.zip.off("input");
            if (myDQE.zipcity) myDQE.removeAutocomplete(myDQE.zipcity);
        };

     

        /**
         * Renvoie true si le code postal est correct
         * @returns {boolean}
         */
        myDQE.valid_zip = function (zip) {
            var country = 'FRA';
            if (!myDQE.zip_pattern[country]) return true;
            return zip.match(myDQE.zip_pattern[country]);
        };



        myDQE.removeAutocomplete = function (element) {
            if (element.data('ui-autocomplete')) {
                element.autocomplete("destroy");
                element.removeData("ui-autocomplete");
            }
        };

        myDQE.clearSection = function (section) {
            if (section == 'zip' && myDQE.zip) {
                myDQE.zip.val("");
                myDQE.clearSection("city");
                myDQE.current_zip = "";
            }
            if (section == 'city' && myDQE.city) {
                myDQE.city.val("");
                myDQE.removeAutocomplete(myDQE.city);
                myDQE.clearSection("local");
                myDQE.clearSection("street");
                myDQE.clearSection("prov");
                myDQE.clearSection("compl");
                myDQE.current_city_id = "";
            }
            if (section == 'zipcity' && myDQE.zipcity) {
                myDQE.zipcity.val("");
                myDQE.removeAutocomplete(myDQE.zipcity);
                myDQE.clearSection("street");
                myDQE.current_zipcity = "";
            }
        };

        /**
         * Remplit tous les champs disponibles lorsqu'une ville est choisie
         * @param city
         */
        myDQE.set_city = function (city) {
            if (myDQE.settings.append_locality && city.local) city.city += ", " + city.local;
            if (myDQE.city) myDQE.city.val(city.city);
            if (myDQE.compl && city.compl) {
                myDQE.compl.val(city.compl);
                myDQE.execute_trigger('compl', [city.compl]);
            }
            else myDQE.clearSection("compl");
            if (myDQE.local && city.local) {
                myDQE.local.val(city.local);
                myDQE.execute_trigger('local', [city.local]);
            }
            if (myDQE.prov && city.prov) {
                myDQE.prov.val(city.prov);
                myDQE.current_prov = city.prov;
                myDQE.execute_trigger('prov', [city.prov]);
            }

            if (myDQE.insee) myDQE.insee.val(city.city_id);

            myDQE.current_city_id = city.city_id;
            myDQE.execute_trigger('city', [city.city_id, city.city]);

            if (city.zip) {
                if (myDQE.zip && myDQE.zip.val() !== city.zip) myDQE.zip.val(city.zip);
                myDQE.current_zip = city.zip;
                myDQE.execute_trigger("zip", city.zip)
            }

            if (city.street && myDQE.street) {
                if (city.street.indexOf('BP_') > -1) {
                    if (city.numbers) myDQE.load_addresses_with_bp(city.street, city.numbers);
                    else {
                        myDQE.street.val(city.street);
                        myDQE.execute_trigger("street", city.street);
                    }
                }
                else {
                    myDQE.street.val(city.street);
                    myDQE.execute_trigger("street", city.street);
                }
            }
            if (city.street_id) {
                myDQE.current_street_id = city.street_id;
                myDQE.street.autocomplete("search", myDQE.street.val());
            }

            //Gestion des noms de société dans le cas des Cedex
            if (city.company && myDQE.company) {
                myDQE.company.val(city.company);
                myDQE.execute_trigger('company', [city.company]);
            }

            if (city.street && myDQE.street && city.numbers) {
                myDQE.show_numbers_directly(city.numbers, city.street, "", city.street_id);
            }
        };

        myDQE.extract_city_name = function (city_name) {
            var p = city_name.lastIndexOf("(");
            if (p === -1) return city_name;
            return myDQE.trim(city_name.substr(0, p));
        };


        myDQE.search_cities = function () {
            myDQE.city_search_enabled = 1;
            myDQE.removeAutocomplete(myDQE.city);
            myDQE.city.autocomplete({
                open: function (event, ui) {
                    $('.ui-autocomplete').css('max-height', '150px').css('overflow-y', 'auto').css('overflow-x', 'hidden');
                    if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                        $('.ui-autocomplete').off('menufocus hover mouseover');
                    }
                },
                create: function () {
                    $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                },
                delay: 0,
                source: function (request, response) {
                    var url = myDQE.url({
                        fn: 'CP',
                        CodePostal: request.term,
                        Alpha: 'True',
                        Instance: 0,
                        Pays: 'FRA'
                    });
                    myDQE.ajax(url, function (data) {
                        data = myDQE.filter_cities(data, true);
                        var lines = [];
                        for (var i = 0; i < data.length; i++) {
                            if (data[i].city.indexOf(" CEDEX") === -1) lines.push(data[i]);
                        }
                        response(lines);
                    });
                },
                minLength: 3,
                select: function (event, ui) {
                    var city_name = myDQE.extract_city_name(ui.item.city);
                    if (myDQE.insee) myDQE.insee.val(city_id);
                    myDQE.calculate_zip(ui.item.city_id, city_name);
                    return false;
                },
                focus: function (event, ui) {
                    event.preventDefault();
                }
            });
        };

        myDQE.show_cities = function (e) {
            myDQE.clearSection("city");
            var zip = myDQE.zip.val();
            if (!myDQE.valid_zip(zip)) return;
            if (!myDQE.city) return;
            if (myDQE.local) myDQE.local.val("");

            var url = myDQE.url({
                fn: 'CP',
                CodePostal: zip,
                Alpha: 'True',
                Instance: 0,
                Pays: 'FRA'
            });
            myDQE.ajax(url, function (data) {
                data = myDQE.filter_cities(data);
                var one_city = data.length == 1 && !myDQE.city.val();
                if (data && data.length > 0) {
                    myDQE.zip.val(zip);
                    myDQE.execute_trigger('zip', [zip]);

                    myDQE.city.autocomplete({
                        open: function (event, ui) {
                            $('.ui-autocomplete').css('max-height', '150px').css('overflow-y', 'auto').css('overflow-x', 'hidden');
                            if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                                $('.ui-autocomplete').off('menufocus hover mouseover');
                            }
                        },
                        create: function () {
                            $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                        },
                        source: data,
                        minLength: 0,
                        select: function (event, ui) {
                            myDQE.set_city(ui.item);
                            return false;
                        }
                    }).off("focus").on("focus", function () {
                        if (!one_city && $(this).data('ui-autocomplete')) $(this).autocomplete("search", $(this).val());
                    });
                    if (one_city) {
                        myDQE.set_city(data[0]);
                    }
                    else myDQE.city.focus();
                }
            });
        };

        myDQE.activate_zipcity_autocomplete = function () {
            var country = 'FRA';
            //Présence d'un champ groupé Code postal/Ville ?
            if (myDQE.zipcity && !myDQE.single) {
                myDQE.removeAutocomplete(myDQE.zipcity);
                myDQE.zipcity.autocomplete({
                    open: function (event, ui) {
                        $('.ui-autocomplete').css('max-height', '150px').css('overflow-y', 'auto').css('overflow-x', 'hidden');
                        if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                            $('.ui-autocomplete').off('menufocus hover mouseover');
                        }
                    },
                    create: function () {
                        $(this).data('ui-autocomplete')._renderItem = myDQE.render_item;
                    },
                    delay: 0,
                    source: function (request, response) {
                        var url = myDQE.url({
                            fn: 'CP',
                            CodePostal: request.term,
                            Alpha: 'True',
                            Instance: 0,
                            Pays: country,
                            Etendue: 'Y',
                            Version: '1.1'
                        });

                        myDQE.ajax(url, function (data) {
                            data = myDQE.filter_cities(data);

                            // si '(' est trouvé dans la valeur de "city" -> chercher les arrondissements
                            if (data[0].city.indexOf('(') !== -1) {
                                myDQE.search_arrondissements(data[0], data[0].city_id.split('-'));
                                var res = myDQE.arrondissements.concat(data);
                                response(res);

                                if (res[0].label === "PARIS (75)" || res[0].label === "MARSEILLE (13)" || res[0].label === "LYON (69)") {
                                    myDQE.zipcity.trigger("click");
                                }
                            }
                            else {
                                myDQE.arrondissements = [];
                                response(data);
                            }
                        });
                    },
                    minLength: 3,
                    select: function (event, ui) {

                        if (myDQE.zipcity && ui.item.city_id.length >= 1) {

                            myDQE.zipcity.val(ui.item.label);

                        }

                        if (myDQE.insee) myDQE.insee.val(ui.item.city_id);

                        if (myDQE.zip && myDQE.city) {
                            myDQE.zip.val(ui.item.zip);
                            myDQE.city.val(ui.item.city);
                        }

                        myDQE.selected_zipcity_value = myDQE.zipcity.val();

                        if (myDQE.local && ui.item.local) {
                            myDQE.local.val(ui.item.local);
                            myDQE.execute_trigger('local', [ui.item.local]);
                        }
                        if (myDQE.prov && ui.item.prov) {
                            myDQE.prov.val(ui.item.prov);
                            myDQE.execute_trigger('prov', [ui.item.prov]);
                        }

                        myDQE.compl.val('');

                        myDQE.current_city_id = ui.item.city_id;
                        myDQE.current_zip = ui.item.zip;
                        myDQE.current_city = ui.item.city;

                        myDQE.execute_trigger('zip', [ui.item.value, ui.item.zip]);
                        myDQE.execute_trigger('city', [ui.item.value, ui.item.city]);

                        if (ui.item.company && myDQE.company) {
                            myDQE.company.val(ui.item.company);
                            myDQE.execute_trigger('company', [ui.item.company]);
                        }

                        if (ui.item.street && myDQE.street) {
                            if (ui.item.street.indexOf('BP_') > -1) {
                                myDQE.load_addresses_with_bp(ui.item.street, ui.item.numbers);
                            }
                            else {
                                myDQE.street.val(ui.item.street);
                                myDQE.execute_trigger("street", ui.item.street)
                            }
                        }

                        if (ui.item.street_id) {
                            myDQE.current_street_id = ui.item.street_id;
                            myDQE.street.autocomplete("search", myDQE.street.val());
                        }
                        return false;
                    },
                    focus: function (event, ui) {
                        event.preventDefault();
                    }
                }).on("click", function () {
                    var value = myDQE.zipcity.val();
                    if ($(this).data('ui-autocomplete') && value.length > 2) $(this).autocomplete("search", value);
                });
            }
        };

        myDQE.activate_zipcity_autocomplete();

        myDQE.url = function (data) {
            host = "https://prod2-free.dqe-software.com";
            var parameters = [];
            for (var key in data) {
                if (!data.hasOwnProperty(key) || key === "fn" || key === "server") continue;
                parameters.push(key + "=" + encodeURIComponent(data[key]));
            }
            return host + '/' + data["fn"] + "/?" + parameters.join("&") + "&Licence=" + encodeURIComponent(myDQE.license);
        };

        if (myDQE.zip && !myDQE.single) {
            myDQE.zip.on("input", function () {
                if (myDQE.zip_pattern.hasOwnProperty('FRA')) {
                    myDQE.show_cities();
                }
            });
        }

        return myDQE;
    };

}(jQuery));
