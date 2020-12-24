
SK = class {
    constructor() {
        this.model = new SK.Model();
        this.tasks = new SK.Tasks(this.model);
        this.gui = new SK.Gui(this.model, this.tasks);
    }

    clearScript() {
        this.tasks.halt();
        this.model.wipe();
        this.gui.destroy();
        sk = null;
        game.msg('Script is dead');
    }
}

/**
 * These are the data structures that govern the automation scripts
 **/
SK.Model = class {
    constructor() {
        // Is a toggle holder. Use like ``auto.craft = true; if (auto.craft) { ...
        this.auto = {};

        // These control the selections under [Minor Options]
        this.minor = {
            observe:true,
            conserveRare:true,
        };
        this.minorNames = {
            program:"Space Programs",
            observe:"Auto Observe",
            feed:"Auto Feed Elders",
            promote:"Auto Promote Leader",
            wait4void:"Only Shatter at Season Start",
            religion2praise:"Praise After Religion",
            unicornIvory:"Unicorn Ivory Optimization",
            conserveRare:"Conserve Rare Resources",
        };

        // These are the assorted variables
        this.books = ['parchment', 'manuscript', 'compedium', 'blueprint'];
        this.option = {
            bookChoice:'none',
            assign:'farmer',
            cycle:0,
            minSecResRatio:1,
            maxSecResRatio:25,
        };

        // These will allow quick selection of the buildings which consume energy
        this.power = {};
        for (var b of ["biolab", "oilWell", "factory", "calciner", "accelerator"]) {
            this.power[b] = game.bld.getBuildingExt(b).meta;
        }

        this.rareResources = [
            "antimatter",
            "blackcoin",
            "eludium",
            "relic",
            "temporalFlux",
            "timeCrystal",
            "unobtainium",
            "void",
        ];

        this.populateDataStructures();
    }

    wipe() {
        this.auto = {}; // wipe fields
        this.minor = {};
        this.options = {};
    }

    populateDataStructures() {
        // Building lists for controlling Auto Build/Space/Time
        this.cathBuildings = {/* list is auto-generated, looks like:
            field:{name:"Catnip Field", enabled:false},
            ...
        */};
        this.cathGroups = [/*
            ["Food Production", ["field", "pasture", "aqueduct"]],
            ...
        */];
        for (var group of game.bld.buildingGroups) {
            var buildings = group.buildings.map(function(n){return game.bld.get(n)});
            this.cathGroups.push([group.title, this.buildGroup(buildings, this.cathBuildings)]);
        }

        this.spaceBuildings = {/*
            spaceElevator:{name:"Space Elevator", enabled:false},
            ...
        */};
        this.spaceGroups = [/*
            ["Cath", ["spaceElevator", "sattelite", "spaceStation"]],
            ...
        */];
        for (var planet of game.space.planets) {
            this.spaceGroups.push([planet.label, this.buildGroup(planet.buildings, this.spaceBuildings)]);
        }

        this.timeBuildings = {/*
            // As above, but for Ziggurats, Cryptotheology, Chronoforge, Void Space
            ...
        */};
        this.timeGroups = [/*
            // As above
            ...
        */];
        this.timeGroups.push(['Ziggurats', this.buildGroup(game.religion.zigguratUpgrades, this.timeBuildings)]);
        this.timeGroups.push(['Cryptotheology', this.buildGroup(game.religion.transcendenceUpgrades, this.timeBuildings)]);
        this.timeGroups.push(['Chronoforge', this.buildGroup(game.time.chronoforgeUpgrades, this.timeBuildings)]);
        this.timeGroups.push(['Void Space', this.buildGroup(game.time.voidspaceUpgrades, this.timeBuildings)]);

    }

    buildGroup(buildings, dict) {
        var group = [];
        for (var building of buildings) {
            if (buildings==game.religion.zigguratUpgrades && building.effects.unicornsRatioReligion) continue; // covered by autoUnicorn()
            var label = building.stages?.map(function(x){return x.label}).join(' / '); // for "Library / Data Center", etc
            label ||= building.label;
            dict[building.name] = {name:label, enabled:false};
            group.push(building.name);
        }
        return group;
    }
}

/**
 * This subclass contains the code that lays out the GUI elements
 **/
SK.Gui = class {
    constructor(model, tasks) {
        this.model = model;
        this.tasks = tasks;
        $("#footerLinks").append('<div id="SK_footerLink" class="column">'
            + ' | <a href="#" onclick="$(\'#SK_mainOptions\').toggle();"> ScriptKitties </a>'
            + '</div>');
        $("#game").append(this.generateMenu());
        $("#SK_mainOptions").hide(); // only way I can find to have display:grid but start hidden
        $("#game").append(this.generateBuildingMenu());
        this.switchTab('cath'); // default
        $("#game").append(this.generateMinorOptionsMenu());
    }

    destroy() {
        $("#SK_footerLink").remove();
        $("#SK_mainOptions").remove();
        $("#SK_buildingOptions").remove();
        $("#SK_minorOptions").remove();
    }

    generateMenu() {
        // Auto Assign drop-down
        var workerDropdown = '<select id="SK_assignChoice" style="{{grid}}" onclick="sk.model.option.assign=this.value;">';
        game.village.jobs.forEach(job => { workerDropdown += `<option value="${job.name}">${job.title}</option>`; });
        workerDropdown += '</select>';

        // Auto Craft Books drop-down
        var bookDropdown = '<select id="SK_bookChoice" style="{{grid}}" onchange="sk.model.option.bookChoice=this.value;">';
        bookDropdown += '<option value="none" selected="selected">None</option>';
        for (var book of this.model.books) {
            var label = game.resPool.get(book).title;
            var label = label[0].toUpperCase() + label.slice(1);
            bookDropdown += `<option value="${book}">${label}</option>`;
        }
        bookDropdown += '</select>';

        // Auto Cycle drop-down
        var cycleDropdown = '<select id="SK_cycleChoice" style="{{grid}}" onchange="sk.model.option.cycle=parseInt(this.value);">';
        for (var i = 0; i < game.calendar.cycles.length; i++) {
            var cycle = game.calendar.cycles[i];
            var sel = (i==this.model.option.cycle) ? ' selected="selected"' : '';
            var label = `${cycle.glyph} ${cycle.title}`;
            cycleDropdown += `<option value="${i}"${sel}>${label}</option>`;
        }
        cycleDropdown += '</select>';

        var grid = [ // Grid Layout
            [this.autoButton('Kill Switch', 'sk.clearScript()')],
            [this.autoButton('Check Efficiency', 'sk.task.kittenEfficiency()'), this.autoButton('Minor Options', '$(\'#SK_minorOptions\').toggle();')],
            [this.autoSwitchButton('Auto Build', 'build'), this.autoButton('Select Building', '$(\'#SK_buildingOptions\').toggle();')],
            [this.autoSwitchButton('Auto Assign', 'assign'), workerDropdown],
            [this.autoSwitchButton('Auto Craft', 'craft'), bookDropdown],
            ['<label style="{{grid}}">Secondary Craft %</label>',
                `<span style="display:flex; justify-content:space-around; {{grid}}" title="Between 0 and 100">`
                + `<label>min:</label><input type="text" style="width:25px" onchange="sk.model.option.minSecResRatio=this.value" value="${this.model.option.minSecResRatio}">`
                + `<label>max:</label><input type="text" style="width:25px" onchange="sk.model.option.maxSecResRatio=this.value" value="${this.model.option.maxSecResRatio}">`
                + `</span>`
            ],
            ['<span style="height:10px;{{grid}}"></span>'],
            [this.autoSwitchButton('Auto Hunt', 'hunt'), this.autoSwitchButton('Auto Praise', 'praise')],
            [this.autoSwitchButton('Auto Trade', 'trade'), this.autoSwitchButton('Auto Embassy', 'embassy')],
            [this.autoSwitchButton('Auto Party', 'party'), this.autoSwitchButton('Auto Explore', 'explore')],
            ['<span style="height:10px;{{grid}}"></span>'],
            [this.autoSwitchButton('Auto Cycle', 'cycle'), cycleDropdown],
            [this.autoSwitchButton('Shatterstorm', 'shatter'), this.autoSwitchButton('Auto BCoin', 'bcoin')],
            ['<span style="height:10px;{{grid}}"></span>'],
            [this.autoSwitchButton('Auto Science', 'research'), this.autoSwitchButton('Auto Upgrade', 'workshop')],
            [this.autoSwitchButton('Auto Religion', 'religion'), this.autoSwitchButton('Auto Unicorn', 'unicorn')],
            [this.autoSwitchButton('Energy Control', 'energy')],
        ];

        var menu = '<div id="SK_mainOptions" class="dialog" style="display:grid; grid-template-columns:177px 177px; column-gap:5px; row-gap:5px; left:auto; top:auto !important; right:30px; bottom: 30px; padding:10px">';
        menu += '<a href="#" onclick="$(\'#SK_mainOptions\').hide();" style="position: absolute; top: 10px; right: 15px;">close</a>';
        for (var row = 0; row < grid.length; row++) {
            for (var col = 0; col < grid[row].length; col++) {
                if (!grid[row][col].includes('{{grid}}')) console.warn(`Cell at [${row+1},${col+1}] does not have position marker`);
                menu += grid[row][col].replace('{{grid}}', `grid-row:${row+1}; grid-column:${col+1};`);
            }
        }
        menu += '</div>';
        return menu;
    }

    generateMinorOptionsMenu() {
        var menu = '';
        menu += '<div id="SK_minorOptions" class="dialog help" style="border: 1px solid gray; display:none;">';
        menu += '<a href="#" onclick="$(\'#SK_minorOptions\').hide();" style="position: absolute; top: 10px; right: 15px;">close</a>';
        for (var opt in this.model.minorNames) {
            menu += `<input type="checkbox" id="SK_${opt}" onchange="sk.model.minor['${opt}']=this.checked"${this.model.minor[opt]?' checked':''}>`;
            menu += `<label style="padding-left:10px;" for="SK_${opt}">${this.model.minorNames[opt]}</label><br>`;
        }
        menu += '</div>';
        return menu;
    }

    generateBuildingMenu() {
        var menu = '';
        menu += '<div id="SK_buildingOptions" class="dialog help" style="border: 1px solid gray; display:none; margin-top:-333px;">';
        menu +=   '<a href="#" onclick="$(\'#SK_buildingOptions\').hide();" style="position: absolute; top: 10px; right: 15px;">close</a>';
        menu +=   '<div class="tabsContainer">';
        menu +=     '<a href="#" id="SK_cathTab" class="tab" onclick="sk.gui.switchTab(\'cath\')" style="white-space: nowrap;">Cath</a>';
        menu +=     '<span> | </span>';
        menu +=     '<a href="#" id="SK_spaceTab" class="tab" onclick="sk.gui.switchTab(\'space\')" style="white-space: nowrap;">Space</a>';
        menu +=     '<span> | </span>';
        menu +=     '<a href="#" id="SK_timeTab" class="tab" onclick="sk.gui.switchTab(\'time\')" style="white-space: nowrap;">Time</a>';
        menu +=   '</div>';
        menu +=   '<div id="SK_BuildingFrame" class="tabInner">';
        menu +=     this.generateBuildingPane(this.model.cathGroups, 'cathBuildings');
        menu +=     this.generateBuildingPane(this.model.spaceGroups, 'spaceBuildings');
        menu +=     this.generateBuildingPane(this.model.timeGroups, 'timeBuildings');
        menu +=   '</div>';
        menu += '</div>';
        return menu;
    }

    switchTab(name) {
        $("#SK_cathTab").removeClass("activeTab");
        $("#SK_spaceTab").removeClass("activeTab");
        $("#SK_timeTab").removeClass("activeTab");
        $("#SK_cathBuildingsPane").hide();
        $("#SK_spaceBuildingsPane").hide();
        $("#SK_timeBuildingsPane").hide();

        switch(name) {
            case 'cath':
                $("#SK_cathTab").addClass("activeTab");
                $("#SK_cathBuildingsPane").show();
                break;
            case 'space':
                $("#SK_spaceTab").addClass("activeTab");
                $("#SK_spaceBuildingsPane").show();
                break;
            case 'time':
                $("#SK_timeTab").addClass("activeTab");
                $("#SK_timeBuildingsPane").show();
                break;
        }
    }

    autoButton(label, script, id=null) {
        var cssClass = 'btn nosel modern';
        if (id) cssClass += ' disabled';
        var content = `<div class="btnContent" style="padding:unset"><span class="btnTitle">${label}</span></div>`;
        var button = `<div ${id?'id="'+id+'"':''} class="${cssClass}" style="width:auto; {{grid}}" onclick="${script}">${content}</div>`;
        return button;
    }

    autoSwitchButton(label, key) {
        var element = 'SK_auto' + key[0].toUpperCase() + key.slice(1);
        var script = `sk.gui.autoSwitch('${key}', '${element}');`;
        return this.autoButton(label, script, element);
    }

    generateBuildingPane(groups, elementsName) {
        var menu = '';
        menu += `<div id="SK_${elementsName}Pane" style="display:none; columns:2; column-gap:20px;">\n`;
        var tab = elementsName.substring(0,4); // tab prefix
        menu += `<input type="checkbox" id="SK_${tab}TabChecker" onchange="sk.gui.selectChildren('SK_${tab}TabChecker','SK_${tab}Check');">`;
        menu += `<label for="SK_${tab}TabChecker">SELECT ALL</label><br>\n`;
        for (var i = 0; i < groups.length; i++)  {
            var label = groups[i][0];
            var lab = label.substring(0,3); // used for prefixes, "lab" is prefix of "label"
            menu += '<p style="break-inside: avoid;">'; // we want grouping to avoid widows/orphans
            menu += `<input type="checkbox" id="SK_${lab}Checker" class="SK_${tab}Check" onchange="sk.gui.selectChildren('SK_${lab}Checker','SK_${lab}Check');">`;
            menu += `<label for="SK_${lab}Checker"><b>${label}</b></label><br>\n`;

            for (var j = 0; j < groups[i][1].length; j++) {
                var bld = groups[i][1][j];
                var bldLabel = this.model[elementsName][bld].name;
                menu += `<input type="checkbox" id="SK_${bld}" class="SK_${lab}Check" onchange="sk.gui.verifyElementSelected(sk.model.${elementsName},\'${bld}\',this.checked)">`;
                menu += `<label style="padding-left:10px;" for="SK_${bld}">${bldLabel}</label><br>\n`;
            }
            menu += '</p>\n';
        }
        menu += '</div>\n';
        return menu;
    }

    selectChildren(checker, checkee) {
        $('.'+checkee).prop('checked', document.getElementById(checker).checked).change();
    }

    verifyElementSelected(elements, id, checked) {
        elements[id].enabled = checked;
    }

    autoSwitch(id, element) {
        this.model.auto[id] = !this.model.auto[id];
        game.msg(`${element} is now  ${(this.model.auto[id] ? 'on' : 'off')}`);
        $(`#${element}`).toggleClass('disabled', !this.model.auto[id]);
    }
}

/**
 * These are the functions which are launched by the runAllAutomation timer
 **/
SK.Tasks = class {
    constructor(model) {
        this.model = model;

        /** This governs how frequently tasks are run
         *   fn: what function to run
         *   interval: how often to run, in ticks, that's 0.2 seconds
         *   offset: small value to stagger runs, MUST be less than interval
         *   override: force run next tick, dynamic, used to take sequences of actions
         **/
        this.schedule = [
            // every tick
            {fn:'autoBuild',    interval:1,  offset:0,   override:false},
            {fn:'autoNip',      interval:1,  offset:0,   override:false},
            {fn:'autoPraise',   interval:1,  offset:0,   override:false},

            // every 0.6 seconds
            {fn:'autoCraft',    interval:3,  offset:0,   override:false},
            {fn:'autoMinor',    interval:3,  offset:1,   override:false},
            {fn:'autoHunt',     interval:3,  offset:2,   override:false},

            // every 2 seconds == every game-day
            {fn:'energyControl',interval:10, offset:2,   override:false},
            {fn:'autoSpace',    interval:10, offset:4,   override:false},
            {fn:'autoParty',    interval:10, offset:6,   override:false},
            {fn:'autoTime',     interval:10, offset:8,   override:false},

            // every 4 seconds; schedule on odd numbers to avoid the interval:10
            {fn:'autoAssign',   interval:20, offset:3,   override:false},
            {fn:'autoResearch', interval:20, offset:7,   override:false},
            {fn:'autoWorkshop', interval:20, offset:9,   override:false},
            {fn:'autoReligion', interval:20, offset:13,  override:false},
            {fn:'autoTrade',    interval:20, offset:15,  override:false},
            {fn:'autoShatter',  interval:20, offset:17,  override:false},
            {fn:'autoEmbassy',  interval:20, offset:19,  override:false},

            // every minute, schedule == 10%20 to avoid both above
            {fn:'autoExplore',  interval:300, offset:70,  override:false},
            {fn:'autoUnicorn',  interval:300, offset:130, override:false},
            {fn:'autoBCoin',    interval:300, offset:230, override:false},
        ]

        // This function keeps track of the game's ticks and uses math to execute these functions at set times relative to the game.
        // Offsets are staggered to spread out the load. (Not that there is much).
        this.runAllAutomation = setInterval(this.taskRunner.bind(this), 200);
    }

    halt() {
        clearInterval(this.runAllAutomation);
    }

    taskRunner() {
        var ticks = game.timer.ticksTotal;
        for (var task of this.schedule) {
            if (task.override || ticks % task.interval == task.offset) {
                task.override = this[task.fn](task.interval, task.override);
            }
        }
    }

    // Show current kitten efficiency in the in-game log
    kittenEfficiency() {
        var secondsPlayed = game.calendar.trueYear() * game.calendar.seasonsPerYear * game.calendar.daysPerSeason * game.calendar.ticksPerDay / game.ticksPerSecond;
        var numberKittens = game.resPool.get('kittens').value;
        var curEfficiency = (numberKittens - 70) / (secondsPlayed / 3600);
        game.msg("Your current efficiency is " + parseFloat(curEfficiency).toFixed(2) + " Paragon per hour.");
    }

    // Collection of Minor Auto Tasks
    autoMinor(ticksPerCycle) {
        if (this.model.minor.feed) {
            if (game.resPool.get("necrocorn").value >= 1 && game.diplomacy.get('leviathans').duration != 0) {
                var energy = game.diplomacy.get("leviathans").energy || 0;
                // I'd rather a less hardcoded method, but that's what they use
                // alternative would be parsing the text, but that seems just as hacky
                var markerCap = Math.floor(
                    (game.religion.getZU("marker").getEffectiveValue(game) * 5 + 5) *
                    (1 + game.getEffect("leviathansEnergyModifier"))
                );
                if (energy < markerCap) {
                    game.diplomacy.feedElders();
                }
            }
        }
        if (this.model.minor.observe) {
            var checkObserveBtn = document.getElementById("observeBtn");
            if (typeof(checkObserveBtn) != 'undefined' && checkObserveBtn != null) {
                document.getElementById('observeBtn').click();
            }
        }
        if (this.model.minor.promote) {
            var leader = game.village.leader;
            if (leader) {
                var expToPromote = game.village.getRankExp(leader.rank);
                var goldToPromote = 25 * (leader.rank + 1);
                if (leader.exp >= expToPromote && game.resPool.get("gold").value >= goldToPromote) {
                    if (game.village.sim.promote(leader) > 0) {
                        var census = game.villageTab.censusPanel.census;
                        census.renderGovernment(census.container);
                        census.update();
                    }
                }
            }
        }
    }

    // Auto praise the sun
    autoPraise(ticksPerCycle) {
        if (this.model.auto.praise && game.bld.getBuildingExt('temple').meta.val > 0) {
            game.religion.praise();
        }
    }

    // Build buildings automatically
    autoBuild(ticksPerCycle) {
        var built = false;
        if (this.model.auto.build && game.ui.activeTabId == 'Bonfire') {
            var buttons = game.bldTab.buttons;

            for (var i = 2; i < buttons.length; i++) {
                var name = buttons[i].model.metadata.name;
                if (buttons[i].model.enabled && this.model.cathBuildings[name].enabled) {
                    buttons[i].controller.buyItem(buttons[i].model, {}, function(result) {
                        if (result) {built = true; buttons[i].update();}
                    });
                }
            }
        }
        // if (built) game.render(); // update tooltip
        return built;
    }

    // Build space stuff automatically
    autoSpace(ticksPerCycle) {
        var built = false;
        if (this.model.auto.build && game.spaceTab && game.spaceTab.planetPanels) {
            // Build space buildings
            for (var i = 0; i < game.spaceTab.planetPanels.length; i++) {
                for (var j = 0; j < game.spaceTab.planetPanels[i].children.length; j++) {
                    var spBuild = game.spaceTab.planetPanels[i].children[j];
                    if (this.model.spaceBuildings[spBuild.id].enabled && game.space.getBuilding(spBuild.id).unlocked) {
                        // .enabled doesn't update automatically unless the tab is active, force it
                        if (! spBuild.model.enabled) spBuild.controller.updateEnabled(spBuild.model);
                        if (spBuild.model.enabled) {
                            spBuild.controller.buyItem(spBuild.model, {}, function(result) {
                                if (result) {built = true; spBuild.update();}
                            });
                        }
                    }
                }
            }

            // Build space programs
            if (this.model.option.program && game.spaceTab && game.spaceTab.GCPanel) {
                var spcProg = game.spaceTab.GCPanel.children;
                for (var i = 0; i < spcProg.length; i++) {
                    if (spcProg[i].model.metadata.unlocked && spcProg[i].model.on == 0) {
                        if (! spcProg[i].model.enabled) spcProg[i].controller.updateEnabled(spcProg[i].model);
                        if (spcProg[i].model.enabled) {
                            spcProg[i].controller.buyItem(spcProg[i].model, {}, function(result) {
                                if (result) {built = true; spcProg[i].update();}
                            });
                        }
                    }
                }
            }
        }
        return built;
    }

    // Build religion/time stuff automatically
    autoTime(ticksPerCycle) {
        var built = false;
        if (this.model.auto.build) {
            var buttonGroups = [
                game.religionTab?.zgUpgradeButtons,
                game.religionTab?.ctPanel?.children[0]?.children,
                game.timeTab?.cfPanel?.children[0]?.children,
                game.timeTab?.vsPanel?.children[0]?.children
            ];

            for (var buttons of buttonGroups) {
                if (buttons) {
                    for (var i = 0; i < buttons.length; i++) {
                        var button = buttons[i];
                        if (this.model.timeBuildings[button.id]?.enabled && button.model.metadata.unlocked) {
                            if (! button.model.enabled) button.controller.updateEnabled(button.model);
                            if (button.model.enabled) {
                                button.controller.buyItem(button.model, {}, function(result) {
                                    if (result) {built = true; button.update();}
                                });
                            }
                        }
                    }
                }
            }
        }
        return built;
    }

    // Trade automatically
    autoTrade(ticksPerCycle) {
        var traded = false;
        if (this.model.auto.trade) {
            var goldResource = game.resPool.get('gold');
            var goldPerCycle = game.getResourcePerTick('gold') * ticksPerCycle;
            var powerResource = game.resPool.get('manpower');
            var powerPerCycle = game.getResourcePerTick('manpower') * ticksPerCycle;
            var powerPerCycle = Math.min(powerPerCycle, powerResource.value); // don't try to spend more than we have
            var sellCount = Math.floor(Math.min(goldPerCycle/15, powerPerCycle/50));

            if (goldResource.value > (goldResource.maxValue - goldPerCycle)) { // don't check catpower
                var tiRes = game.resPool.get('titanium');
                var unoRes = game.resPool.get('unobtainium');

                if (unoRes.value > 5000 && game.diplomacy.get('leviathans').unlocked && game.diplomacy.get('leviathans').duration != 0) {
                    game.diplomacy.tradeAll(game.diplomacy.get("leviathans"));
                    traded = true;
                } else if (tiRes.value < (tiRes.maxValue * 0.9) && game.diplomacy.get('zebras').unlocked) {
                    // don't waste the iron, make some space for it.
                    var ironRes = game.resPool.get('iron');
                    var sellIron = game.diplomacy.get("zebras").sells[0];
                    var expectedIron = sellIron.value * sellCount *
                        (1 + (sellIron.seasons ? sellIron.seasons[game.calendar.getCurSeason().name] : 0)) *
                        (1 + game.diplomacy.getTradeRatio() + game.diplomacy.calculateTradeBonusFromPolicies('zebras', game));
                    if (ironRes.value > (ironRes.maxValue - expectedIron)) {
                        game.craft('plate', (ironRes.value - (ironRes.maxValue - expectedIron))/125); // 125 is iron per plate
                    }

                    // don't overdo it
                    var deltaTi = tiRes.maxValue - tiRes.value;
                    var expectedTi = game.resPool.get("ship").value * 0.03;
                    sellCount = Math.ceil(Math.min(sellCount, deltaTi / expectedTi));
                    game.diplomacy.tradeMultiple(game.diplomacy.get("zebras"), sellCount);
                    traded = true;
                }
            }
        }
        return traded;
    }

    // Build Embassies automatically
    autoEmbassy(ticksPerCycle) {
        var built = false;
        if (this.model.auto.embassy && game.diplomacyTab.racePanels && game.diplomacyTab.racePanels[0]) {
            var culture = game.resPool.get('culture');
            if (culture.value >= culture.maxValue * 0.99) { // can exceed due to MS usage
                var panels = game.diplomacyTab.racePanels;
                var btn = panels[0].embassyButton;
                for (var z = 1; z < panels.length; z++) {
                    var candidate = panels[z].embassyButton;
                    if (candidate && candidate.model.prices[0].val < btn.model.prices[0].val) {
                        btn = candidate;
                    }
                }
                btn.controller.buyItem(btn.model, {}, function(result) {
                    if (result) {built = true; btn.update();}
                });
            }
        }
        return built;
    }

    // Explore for new Civs
    autoExplore(ticksPerCycle) {
        var available = false;
        if (this.model.auto.explore && game.diplomacyTab.visible && game.resPool.get("manpower").value >= 1000) {
            for (var race of game.diplomacy.races) {
                if (race.unlocked) continue;
                switch(race.name) {
                    case 'lizards': case 'sharks': case 'griffins':
                        available = true;
                        break;
                    case 'nagas':
                        available = game.resPool.get("culture").value >= 1500;
                        break;
                    case 'zebras':
                        available = game.resPool.get("ship").value >= 1;
                        break;
                    case 'spiders':
                        available = Pool.get("ship").value >= 100 && this.game.resPool.get("science").maxValue > 125000;
                        break;
                    case 'dragons':
                        available = game.science.get("nuclearFission").researched;
                        break;
                    case 'leviathans':
                        break;
                    default:
                        console.log(`WARNING: unrecognized race: ${race.name} in minor/Explore`);
                }
                if (available) break;
            }
            if (available && game.diplomacyTab.exploreBtn) {
                var button = game.diplomacyTab.exploreBtn;
                button.controller.buyItem(button.model, {}, function(result) {
                    if (result) {built = true; button.update();}
                });
            }
        }
        return available;
    }

    // Hunt automatically
    autoHunt(ticksPerCycle) {
        if (this.model.auto.hunt) {
            var catpower = game.resPool.get('manpower');
            if (catpower.value > (catpower.maxValue - 1)) {
                game.village.huntAll();
            }
        }
        return false; // we huntAll(), should never need to run again
    }

    // Craft primary resources automatically
    autoCraft(ticksPerCycle) {
        /* Note: In this function, rounding gives us grief.
         * If we have enough resource to craft 3.75 of of something, and ask for
         * that, the game rounds up to 4 and then fails because we don't have
         * enough.
         *
         * However, we mostly craft "off the top", making space for production,
         * so we'll usually have the slack. But when we don't, it effectively turns
         * off autoCraft for that resource.
         *
         * On the other hand, we don't want to always round down, or else we'll be
         * wasting resources, and in some cases *cough*eludium*cough*, we'll be
         * rounding down to zero.
         */

        // TODO: We need a special case for catnip->wood.
        // In particular, we need to only craft wood if there's room
        // AND we need to make room by crafting
        if (this.model.auto.craft) {
            for (var res of game.workshop.crafts) {
                var output = res.name;
                var inputs = res.prices;
                var outRes = game.resPool.get(output);
                if (! outRes.unlocked) continue;

                var craftCount = Infinity;
                var minimumReserve = Infinity;
                for (var input of inputs) {
                    var inRes = game.resPool.get(input.name);
                    craftCount = Math.min(craftCount, Math.floor(inRes.value / input.val)); // never try to use more than we have

                    if (inRes.maxValue != 0) {
                        // primary resource
                        var resourcePerCycle = game.getResourcePerTick(input.name, 0) * ticksPerCycle;
                        if (inRes.value >= (inRes.maxValue - resourcePerCycle) || resourcePerCycle >= inRes.maxValue) {
                            craftCount = Math.min(craftCount, resourcePerCycle / input.val);
                        } else {
                            craftCount = 0;
                        }
                    } else if (this.model.books.includes(output)) {
                        // secondary resource: fur, parchment, manuscript, compendium
                        var outputIndex = this.model.books.indexOf(output);
                        var choiceIndex = this.model.books.indexOf(this.model.option.bookChoice);
                        if (outputIndex <= choiceIndex) {
                            craftCount = Math.min(craftCount, (inRes.value / input.val));
                        } else {
                            craftCount = 0;
                        }
                    } else {
                        // secondary resource: general
                        var resMath = inRes.value / input.val;
                        if (resMath <= 1 || outRes.value > (inRes.value * (this.model.option.maxSecResRatio / 100))) craftCount = 0;
                        craftCount = Math.min(craftCount, resMath * (this.model.option.maxSecResRatio / 100));
                    }
                    // for when our capacity gets large compared to production
                    minimumReserve = Math.min(minimumReserve, (inRes.value / input.val) * (this.model.option.minSecResRatio / 100) - outRes.value / game.getEffect('craftRatio'));
                }

                craftCount = Math.max(craftCount, minimumReserve);
                if (craftCount == 0 || craftCount == Infinity) {
                    // nothing to do
                } else if (this.model.option.bookChoice == 'blueprint' && output == 'compedium' && game.resPool.get('compedium').value > 25) {
                    // save science for making blueprints
                } else {
                    game.craft(output, craftCount);
                }
            }
        }
        return false; // we scale action to need, re-run never required
    }

    // Auto Research
    autoResearch(ticksPerCycle) {
        var acted = false;
        if (this.model.auto.research && game.libraryTab.visible) {
            var science = game.resPool.get('science').value;
            var bestButton = null;
            var bestCost = Infinity;
            techloop: for (var button of game.libraryTab.buttons) {
                var cost = 0;
                for (var price of button.model.prices) {
                    if (price.name == 'science') cost = price.val;
                    if (this.model.minor.conserveRare && this.model.rareResources.includes(price.name)) {
                        continue techloop;
                    }
                }
                if (cost < science && cost < bestCost && button.model.metadata.unlocked && button.model.metadata.researched != true) {
                    if ( ! button.model.enabled) button.update();
                    if (button.model.enabled) {
                        bestButton = button;
                        bestCost = cost;
                    }
                }
            }
            if (bestButton) {
                bestButton.controller.buyItem(bestButton.model, {}, function(result) {
                    if (result) {acted = true; bestButton.update();}
                });
            }
        }
        return acted;
    }

    // Auto buy workshop upgrades
    autoWorkshop(ticksPerCycle) {
        var acted = false;
        if (this.model.auto.workshop && game.workshopTab.visible) {
            var science = game.resPool.get('science').value;
            var bestButton = null;
            var bestCost = Infinity;
            workloop: for (var button of game.workshopTab.buttons) {
                var cost = 0;
                for (var price of button.model.prices) {
                    if (price.name == 'science') cost = price.val;
                    if (this.model.minor.conserveRare && this.model.rareResources.includes(price.name)) {
                        continue workloop;
                    }
                }
                if (cost < science && cost < bestCost && button.model.metadata.unlocked && button.model.metadata.researched != true) {
                    if ( ! button.model.enabled) button.update();
                    if (button.model.enabled) {
                        bestButton = button;
                        bestCost = cost;
                    }
                }
            }
            if (bestButton) {
                bestButton.controller.buyItem(bestButton.model, {}, function(result) {
                    if (result) {acted = true; bestButton.update();}
                });
            }
        }
        return acted;
    }

    // Auto buy religion upgrades
    autoReligion(ticksPerCycle) {
        var bought = false;
        if (this.model.auto.religion && game.religionTab.visible) {
            var buttons = game.religionTab.rUpgradeButtons;
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].model.visible && buttons[i].model.metadata.researched != true) {
                    if ( ! buttons[i].model.enabled) buttons[i].update();
                    if (buttons[i].model.enabled) {
                        buttons[i].controller.buyItem(buttons[i].model, {}, function(result) {
                            if (result) { bought = true; buttons[i].update(); }
                        });
                    }
                }
            }
            var faith = game.resPool.get('faith');
            if (this.model.minor.religion2praise && bought == false && faith.value >= faith.maxValue) {
                this.autoSwitch('praise', 'SK_autoPraise');
                this.model.auto.praise = true;
            }
        }
        return bought;
    }

    // Auto buy unicorn upgrades
    autoUnicorn(ticksPerCycle) {
        var acted = false;
        if (this.model.auto.unicorn && game.religionTab.visible) {
            /* About Unicorn Rifts
             * Each Tower causes a 0.05% chance for a rift per game-day
             * Each rift produces 500 Unicorns * (Unicorn Production Bonus)/10
             */
            var riftUnicorns = 500 * (1 + game.getEffect("unicornsRatioReligion") * 0.1);
            var unicornChanceRatio = 1.1 * (1 + game.getEffect("timeRatio") * 0.25);
            var upsprc = riftUnicorns * unicornChanceRatio / 2; // unicorns per second per riftChance
            var ups = 5 * game.getResourcePerTick('unicorns') / (1 + game.getEffect("unicornsRatioReligion"));
            // Constants for Ivory Meteors
            var meteorChance = game.getEffect("ivoryMeteorChance") * unicornChanceRatio / 2;
            var ivoryPerMeteor = 250 + 749.5 * (1 + game.getEffect("ivoryMeteorRatio"));

            // find which is the best value
            var buttons = game.religionTab.zgUpgradeButtons;
            var bestButton = null;
            var bestValue = 0.0;
            for (var i = 0; i < buttons.length; i++) {
                if (buttons[i].model.metadata.unlocked) {
                    if (! this.model.minor.unicornIvory) {
                        var tearCost = buttons[i].model.prices.find(function(element){return element.name==='tears'});
                        if (tearCost == null) continue;
                        var ratio = buttons[i].model.metadata.effects.unicornsRatioReligion;
                        var rifts = buttons[i].model.metadata.effects.riftChance || 0;
                        var value = (ratio * ups + rifts * upsprc) / tearCost.val;
                    } else {
                        var ivoryCost = buttons[i].model.prices.find(function(element){return element.name==='ivory'});
                        if (ivoryCost == null) continue;
                        var ratio = buttons[i].model.metadata.effects.ivoryMeteorRatio || 0;
                        var chance = buttons[i].model.metadata.effects.ivoryMeteorChance || 0;
                        value = (meteorChance * ratio * 749.5 + chance * unicornChanceRatio/2 * ivoryPerMeteor) / ivoryCost.val;
                    }
                    if (value > bestValue) {
                        bestButton = buttons[i];
                        bestValue = value;
                    }
                }
            }

            // can we afford it?
            if (bestButton != null) {
                var otherCosts = true;
                for (var price of bestButton.model.prices) {
                    if (price.name == 'tears') {
                        var tearCost = price.val;
                    } else if (price.val > game.resPool.get(price.name).value) {
                        otherCosts = false;
                    }
                }
                if (otherCosts) {
                    var unicorns = game.resPool.get('unicorns').value;
                    var tears = game.resPool.get('tears').value;
                    var zigs = game.bld.get("ziggurat").on;
                    var available = tears + Math.floor(unicorns / 2500) * zigs;
                    if (available > tearCost) {
                        if (tears < tearCost) {
                            var sacButton = game.religionTab.sacrificeBtn;
                            // XXX: I don't like calling an internal function like _transform
                            // But it's the only way to request a specific number of Unicorn sacrifices, instead of spam-clicking...
                            sacButton.controller._transform(sacButton.model, Math.ceil((tearCost - tears) / zigs));
                        }
                        if ( ! bestButton.model.enabled) bestButton.update();
                        bestButton.controller.buyItem(bestButton.model, {}, function(result) {
                            if (result) {acted = true; bestButton.update();}
                        });
                    }
                }
            }
        }
        return acted;
    }

    // Festival automatically
    autoParty(ticksPerCycle) {
        if (this.model.auto.party && game.science.get("drama").researched) {
            var catpower = game.resPool.get('manpower').value;
            var culture = game.resPool.get('culture').value;
            var parchment = game.resPool.get('parchment').value;

            if (catpower > 1500 && culture > 5000 && parchment > 2500) {
                if (game.prestige.getPerk("carnivals").researched && game.calendar.festivalDays < 400*10) {
                    game.village.holdFestival(1);
                } else if (game.calendar.festivalDays == 0) {
                    game.village.holdFestival(1);
                }
            }
        }
        return false; // there is never a need to re-run
    }

    // Auto assign new kittens to selected job
    autoAssign(ticksPerCycle) {
        if (this.model.auto.assign && game.village.getJob(this.model.option.assign).unlocked && game.village.hasFreeKittens()) {
            game.village.assignJob(game.village.getJob(this.model.option.assign), 1);
            return true;
        } else {
            return false;
        }
    }

    autoDoShatter(years) {
        // limit to 5 years per tick, mostly to allow crafting time
        var timeslip = false;
        if (years > 5) {
            years = 5;
            timeslip = true;
        }

        // mass craft
        var shatterTCGain = game.getEffect("shatterTCGain") * (1 + game.getEffect("rrRatio"));
        var cal = game.calendar;
        var ticksPassing = years * cal.seasonsPerYear * cal.daysPerSeason * cal.ticksPerDay;
        this.autoCraft(shatterTCGain * ticksPassing);

        // do shatter
        var btn = game.timeTab.cfPanel.children[0].children[0]; // no idea why there's two layers in the code
        btn.controller.doShatterAmt(btn.model, years);
        return timeslip;
    }

    // Keep Shattering as long as Space-Time is cool enough
    autoShatter(ticksPerCycle, shattering) {
        var timeslip = false;
        if (this.model.auto.shatter || this.model.auto.cycle) {
            if (game.timeTab.cfPanel.visible && game.calendar.day >= 0) { // avoid shattering DURING paradox
                var startOfSeason = game.calendar.day * game.calendar.ticksPerDay < 3 * ticksPerCycle;
                var lowHeat = game.time.heat < Math.max(5, ticksPerCycle * game.getEffect("heatPerTick"));
                var startStorm = shattering || (this.model.minor.wait4void ? startOfSeason : true) && lowHeat;

                // find length of shatter storm
                var shatter = 0;
                if (this.model.auto.shatter && startStorm) {
                    // how many shatters worth of heat can we afford?
                    var factor = game.challenges.getChallenge("1000Years").researched ? 5 : 10;
                    var shatter = Math.ceil((game.getEffect('heatMax') - game.time.heat) / factor);
                }

                // adjust to end in the right cycle
                if (this.model.auto.cycle && game.calendar.cycle != this.model.option.cycle) {
                    // desired cycle: sk.model.option.cycle
                    // current cycle: game.calendar.cycle
                    // year in cycle: game.calendar.cycleYear
                    var deltaCycle = (this.model.option.cycle - game.calendar.cycle + game.calendar.cycles.length) % game.calendar.cycles.length;
                    var yearsToCycle = deltaCycle*5 - game.calendar.cycleYear;
                    shatter = Math.floor(shatter / 50)*50 + yearsToCycle;
                }

                // click the button
                if (shatter != 0 && shatter < game.resPool.get('timeCrystal').value) {
                    timeslip = this.autoDoShatter(shatter);
                }
            }
        }
        return timeslip;
    }

    // Control Energy Consumption
    energyControl(ticksPerCycle) {
        if (this.model.auto.energy) {
            var proVar = game.resPool.energyProd;
            var conVar = game.resPool.energyCons;

            if (this.model.power.accelerator.val > this.model.power.accelerator.on && proVar > (conVar + 3)) {
                this.model.power.accelerator.on++;
                conVar++;
            } else if (this.model.power.calciner.val > this.model.power.calciner.on && proVar > (conVar + 3)) {
                this.model.power.calciner.on++;
                conVar++;
            } else if (this.model.power.factory.val > this.model.power.factory.on && proVar > (conVar + 3)) {
                this.model.power.factory.on++;
                conVar++;
            } else if (this.model.power.oilWell.val > this.model.power.oilWell.on && proVar > (conVar + 3)) {
                this.model.power.oilWell.on++;
                conVar++;
            } else if (this.model.power.bioLab.val > this.model.power.bioLab.on && proVar > (conVar + 3)) {
                this.model.power.bioLab.on++;
                conVar++;
            } else if (this.model.power.bioLab.on > 0 && proVar < conVar) {
                this.model.power.bioLab.on--;
                conVar--;
            } else if (this.model.power.oilWell.on > 0 && proVar < conVar) {
                this.model.power.oilWell.on--;
                conVar--;
            } else if (this.model.power.factory.on > 0 && proVar < conVar) {
                this.model.power.factory.on--;
                conVar--;
            } else if (this.model.power.calciner.on > 0 && proVar < conVar) {
                this.model.power.calciner.on--;
                conVar--;
            } else if (this.model.power.accelerator.on > 0 && proVar < conVar) {
                this.model.power.accelerator.on--;
                conVar--;
            }
        }
        return false;
    }

    // Auto buys and sells bcoins optimally (not yet tested)
    autoBCoin(ticksPerCycle) {
        if (this.model.auto.bcoin && game.science.get("antimatter").researched) {
            // When the price is > 1100 it loses 20-30% of its value
            // 880+ε is the highest it could be after an implosion
            if (game.calendar.cryptoPrice < 1095) {
                game.diplomacy.buyBcoin();
            } else if (game.resPool.get('blackcoin').value > 0) {
                game.diplomacy.sellBcoin();
            }
        }
        return false;
    }

    autoNip(ticksPerCycle) {
        if (this.model.auto.build && game.bld.get('field').val < 20) {
            $(`.btnContent:contains(${$I('buildings.gatherCatnip.label')})`).trigger("click");
        }
        if (this.model.auto.craft && game.bld.get('workshop').val < 1 && game.bld.get('hut').val < 5) {
            if (game.bldTab.buttons[1].model.enabled) {
                $(`.btnContent:contains(${$I('buildings.refineCatnip.label')})`).trigger("click");
            }
        }
        return false;
    }
}

var sk = new SK();

