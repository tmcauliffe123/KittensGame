
SK = class {
    constructor() {
        this.model = new SK.Model();
        this.scripts = new SK.Scripts(this.model);
        this.tasks = new SK.Tasks(this.model, this.scripts);
        this.gui = new SK.Gui(this.model, this.tasks);
        this.loadOptions();
    }

    clearScript() {
        this.tasks.halt();
        this.model.wipe();
        this.gui.destroy();
        sk = null;
        delete(LCstorage["net.sagefault.ScriptKittens.savedata"]);
        game.msg('Script is dead');
    }

    // Note: this function is deliberately not exposed in the gui.
    // Reloading is for people already playing around in console.
    reloadScript() {
        // unload and save
        this.tasks.halt();
        this.saveOptions();
        this.model.wipe();
        this.gui.destroy();
        sk = null;
        // reload
        var src = null;
        var origins = $("#SK_origin");
        for (var i=0; i<origins.length; i+=1) {
            if (origins[i].src) src = origins[i].src;
            origins[i].remove();
        }
        if (src) {
            var script = document.createElement('script');
            script.src = src;
            script.id = 'SK_origin';
            document.body.appendChild(script);
        } else {
            console.error("No <script> found with id=='SK_origin'");
        }
    }

    saveOptions() {
        var options = {}
        this.model.save(options);
        this.scripts.save(options);
        LCstorage["net.sagefault.ScriptKittens.savedata"] = JSON.stringify(options);
    }

    loadOptions() {
        var dataString = LCstorage["net.sagefault.ScriptKittens.savedata"];
        if (dataString) {
            try {
                var options = JSON.parse(dataString);
            } catch (ex) {
                console.error("Unable to load game data: ", ex);
                console.log(dataString);
                game.msg("Unable to load script settings. Settings were logged to console.", "important")
                delete(LCstorage["net.sagefault.ScriptKittens.loaddata"]);
                game.msg("Settings deleted.");
            }
            this.model.load(options);
            this.scripts.load(options);
            this.gui.refresh();
        }
    }
}

/**
 * These are the data structures that govern the automation scripts
 **/
SK.Model = class {
    constructor() {
        // Is a toggle holder. Use like ``auto.craft = true; if (auto.craft) { ...
        this.auto = {};

        // These are the assorted variables
        this.books = ['parchment', 'manuscript', 'compedium', 'blueprint'];
        this.option = {};

        // These control the selections under [Minor Options]
        this.minor = {};
        this.minorNames = {
            program:'Space Programs',
            observe:'Auto Observe',
            feed:'Auto Feed Elders',
            promote:'Auto Promote Leader',
            wait4void:'Only Shatter at Season Start',
            praiseAfter:'Praise After Religion',
            unicornIvory:'Unicorn Ivory Optimization',
            conserveExotic:'Conserve Exotic Resources',
        };

        // These will allow quick selection of the buildings which consume energy
        this.power = {};
        for (var b of ['biolab', 'oilWell', 'factory', 'calciner', 'accelerator']) {
            this.power[b] = game.bld.get(b);
        }

        // Note: per game: uncommon==luxuries==(trade goods), rare==unicorns+karma, exotic==relics+void+bc+bs
        this.exoticResources = [
            'antimatter', // how is AM not exotic?
            'blackcoin',
            'bloodstone',
            'relic',
            'temporalFlux', // honorary
            'void',
        ];

        this.setDefaults();
        this.populateDataStructures();
    }

    setDefaults() {
        this.option = {
            book:'default',
            assign:'smart',
            cycle:'redmoon',
            minSecResRatio:1,
            maxSecResRatio:25,
            script:'none',
        };
        this.minor = {
            observe:true,
            conserveExotic:true,
        };
    }

    wipe() {
        this.auto = {}; // wipe fields
        this.minor = {};
        this.option = {};
        for (var buildset of [this.cathBuildings, this.spaceBuildings, this.timeBuildings]) {
            for (var bid in buildset) {
                delete buildset[bid].limit;
                buildset[bid].enabled = false;
            }
        }
    }

    save(options) {
        for (var key of ['auto', 'minor', 'option', 'cathBuildings', 'spaceBuildings', 'timeBuildings']) {
            options[key] = this[key];
        }
    }

    load(options) {
        for (var key of ['auto', 'minor', 'option', 'cathBuildings', 'spaceBuildings', 'timeBuildings']) {
            if (options[key]) this[key] = options[key];
        }
    }

    populateDataStructures() {
        // Building lists for controlling Auto Build/Space/Time
        this.cathBuildings = {/* list is auto-generated, looks like:
            field:{label:'Catnip Field', enabled:false},
            ...
        */};
        this.cathGroups = [/*
            ['Food Production', ['field', 'pasture', 'aqueduct']],
            ...
        */];
        for (var group of game.bld.buildingGroups) {
            var buildings = group.buildings.map(function(n){return game.bld.get(n)});
            this.cathGroups.push([group.title, this.buildGroup(buildings, this.cathBuildings)]);
        }

        this.spaceBuildings = {/*
            spaceElevator:{label:'Space Elevator', enabled:false},
            ...
        */};
        this.spaceGroups = [/*
            ['Cath', ['spaceElevator', 'sattelite', 'spaceStation']],
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
            var label = building.stages?.map(function(x){return x.label}).join(' / '); // for 'Library / Data Center', etc
            label ||= building.label;
            dict[building.name] = {label:label, enabled:false};
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
        this.switches = {};
        this.dropdowns = {};
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
        var grid = [ // Grid Layout
            [this.autoButton('Kill Switch', 'sk.clearScript()')],
            [this.autoButton('Check Efficiency', 'sk.tasks.kittenEfficiency()'), this.autoButton('Minor Options', '$(\'#SK_minorOptions\').toggle();')],
            [this.autoSwitchButton('Auto Build', 'build'), this.autoButton('Select Building', '$(\'#SK_buildingOptions\').toggle();')],
            [this.autoSwitchButton('Auto Assign', 'assign'), this.autoDropdown('assign', ['smart'], game.village.jobs)],
            [this.autoSwitchButton('Auto Craft', 'craft'), this.autoDropdown('book', ['default'].concat(this.model.books), [])],
            ['<label style="{{grid}}">Secondary Craft %</label>',
                `<span style="display:flex; justify-content:space-around; {{grid}}" title="Between 0 and 100">`
                + `<label>min:</label><input id="SK_minSRS" type="text" style="width:25px" onchange="sk.model.option.minSecResRatio=this.value" value="${this.model.option.minSecResRatio}">`
                + `<label>max:</label><input id="SK_maxSRS" type="text" style="width:25px" onchange="sk.model.option.maxSecResRatio=this.value" value="${this.model.option.maxSecResRatio}">`
                + `</span>`
            ],
            ['<span style="height:10px;{{grid}}"></span>'],

            [this.autoSwitchButton('Auto Hunt', 'hunt'), this.autoSwitchButton('Auto Praise', 'praise')],
            [this.autoSwitchButton('Auto Trade', 'trade'), this.autoSwitchButton('Auto Embassy', 'embassy')],
            [this.autoSwitchButton('Auto Party', 'party'), this.autoSwitchButton('Auto Explore', 'explore')],
            ['<span style="height:10px;{{grid}}"></span>'],

            [this.autoSwitchButton('Auto Cycle', 'cycle'), this.autoDropdown('cycle', [], game.calendar.cycles)],
            [this.autoSwitchButton('Shatterstorm', 'shatter'), this.autoSwitchButton('Auto BCoin', 'bcoin')],
            [this.autoSwitchButton('Auto Play', 'play'), this.autoDropdown('script', ['none'], SK.Scripts.listScripts(), 'sk.gui.scriptChange(this.value)')],
            ['<span style="height:10px;{{grid}}"></span>'],

            [this.autoSwitchButton('Auto Science', 'research'), this.autoSwitchButton('Auto Upgrade', 'workshop')],
            [this.autoSwitchButton('Auto Religion', 'religion'), this.autoSwitchButton('Auto Unicorn', 'unicorn')],
            [this.autoSwitchButton('Energy Control', 'energy'), this.autoSwitchButton('Auto Flux', 'flux')],
        ];
        this.dropdowns['minSecResRatio'] = 'SK_minSRS';
        this.dropdowns['maxSecResRatio'] = 'SK_maxSRS';

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
        menu += '<div id="SK_buildingOptions" class="dialog help" style="border: 1px solid gray; display:none; margin-top:-333px; margin-left:-200px;">';
        menu +=   '<a href="#" onclick="$(\'#SK_buildingOptions\').hide();" style="position: absolute; top: 10px; right: 15px;">close</a>';
        menu +=   '<div class="tabsContainer" style="position: static;">';
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

    generateBuildingPane(groups, elementsName) {
        var menu = '';
        menu += `<div id="SK_${elementsName}Pane" style="display:none; columns:2; column-gap:20px;">\n`;
        var tab = elementsName.substring(0,4); // tab prefix
        menu += `<input type="checkbox" id="SK_${tab}TabChecker" onchange="sk.gui.selectChildren('SK_${tab}TabChecker','SK_${tab}Check');">`;
        menu += `<label for="SK_${tab}TabChecker">SELECT ALL</label><br>\n`;
        for (var group of groups) {
            var label = group[0];
            var lab = label.substring(0,3); // used for prefixes, "lab" is prefix of "label"
            menu += '<p style="break-inside: avoid;">'; // we want grouping to avoid widows/orphans
            menu += `<input type="checkbox" id="SK_${lab}Checker" class="SK_${tab}Check" onchange="sk.gui.selectChildren('SK_${lab}Checker','SK_${lab}Check');">`;
            menu += `<label for="SK_${lab}Checker"><b>${label}</b></label><br>\n`;

            for (var bld of group[1]) {
                menu += `<input type="checkbox" id="SK_${bld}" class="SK_${lab}Check" onchange="sk.model.${elementsName}.${bld}.enabled=this.checked; sk.model.${elementsName}.${bld}.limit=false">`;
                menu += `<label style="padding-left:10px;" for="SK_${bld}">${this.model[elementsName][bld].label}</label><br>\n`;
            }
            menu += '</p>\n';
        }
        menu += '</div>\n';
        return menu;
    }

    selectChildren(checker, checkee) {
        $('.'+checkee).prop('checked', document.getElementById(checker).checked).change();
    }

    autoSwitch(id, element) {
        this.model.auto[id] = !this.model.auto[id];
        game.msg(`${element} is now ${(this.model.auto[id] ? 'on' : 'off')}`);
        $(`#${element}`).toggleClass('disabled', !this.model.auto[id]);
    }

    autoButton(label, script, id=null) {
        var cssClass = 'btn nosel modern';
        if (id) cssClass += ' disabled';
        var content = `<div class="btnContent" style="padding:unset"><span class="btnTitle">${label}</span></div>`;
        var button = `<div ${id?'id="'+id+'"':''} class="${cssClass}" style="width:auto; {{grid}}" onclick="${script}">${content}</div>`;
        return button;
    }

    autoSwitchButton(label, auto) {
        var element = 'SK_auto' + auto[0].toUpperCase() + auto.slice(1);
        this.switches[auto] = element;
        var script = `sk.gui.autoSwitch('${auto}', '${element}');`;
        return this.autoButton(label, script, element);
    }

    autoDropdown(option, extras, items, script) {
        var element = `SK_${option}Choice`;
        this.dropdowns[option] = element;
        script ||= `sk.model.option.${option}=this.value;`;
        var dropdown = `<select id="${element}" style="{{grid}}" onchange="${script}">`;
        for (var name of extras) {
            var sel = (name == this.model.option[option]) ? ' selected="selected"' : '';
            var title = name[0].toUpperCase() + name.slice(1);
            dropdown += `<option value="${name}"${sel}>${title}</option>`;
        }
        for (var item of items) {
            var sel = (item.name == this.model.option[option]) ? ' selected="selected"' : '';
            var title = item.title;
            if (item.glyph) title = item.glyph + ' ' + title;
            dropdown += `<option value="${item.name}"${sel}>${title}</option>`;
        }
        dropdown += '</select>';
        return dropdown;
    }

    scriptChange(value) {
        this.model.option.script = value;
        sk.scripts.init();
        if (this.model.auto.play) this.autoSwitch('play', 'SK_autoPlay');
    }

    refresh() {
        for (var auto in this.model.auto) {
            var element = this.switches[auto];
            $('#'+element).toggleClass('disabled', !this.model.auto[auto])
        }
        for (var option in this.model.option) {
            var element = this.dropdowns[option];
            $('#'+element).val(this.model.option[option]);
        }
        for (var minor in this.model.minor) {
            $('#SK_'+minor).prop('checked', this.model.minor[minor]);
        }
        for (var menu of ['cathBuildings', 'spaceBuildings', 'timeBuildings']) {
            for (var entry in this.model[menu]) {
                $('#SK_'+entry).prop('checked', this.model[menu][entry].enabled);
            }
        }
    }
}

/**
 * These are the functions which are launched by the runAllAutomation timer
 **/
SK.Tasks = class {
    constructor(model, scripts) {
        this.model = model;
        this.scripts = scripts;

        /** This governs how frequently tasks are run
         *   fn: what function to run
         *   interval: how often to run, in ticks, that's 0.2 seconds
         *   offset: small value to stagger runs, MUST be less than interval
         *   override: force run next tick, dynamic, used to take sequences of actions
         **/
        this.schedule = [
            // every tick
            {fn:'autoNip',      interval:1,  offset:0,   override:false},
            {fn:'autoPraise',   interval:1,  offset:0,   override:false},
            {fn:'autoBuild',    interval:1,  offset:0,   override:false},

            // every 3 ticks == 0.6 seconds
            {fn:'autoCraft',    interval:3,  offset:0,   override:false},
            {fn:'autoMinor',    interval:3,  offset:1,   override:false},
            {fn:'autoHunt',     interval:3,  offset:2,   override:false},

            // every 5 ticks == 1 second
            {fn:'autoPlay',     interval:5,  offset:0,   override:false},

            // every 2 seconds == every game-day
            {fn:'autoSpace',    interval:10, offset:2,   override:false},
            {fn:'autoTime',     interval:10, offset:4,   override:false},
            {fn:'autoParty',    interval:10, offset:6,   override:false},
            {fn:'energyControl',interval:10, offset:8,   override:false},

            // every 4 seconds; schedule on odd numbers to avoid the interval:10
            {fn:'autoFlux',     interval:20, offset:1,   override:false},
            {fn:'autoAssign',   interval:20, offset:3,   override:false},
            {fn:'autoResearch', interval:20, offset:7,   override:false},
            {fn:'autoWorkshop', interval:20, offset:9,   override:false},
            {fn:'autoReligion', interval:20, offset:11,  override:false},
            {fn:'autoTrade',    interval:20, offset:13,  override:false},
            {fn:'autoShatter',  interval:20, offset:17,  override:false},
            {fn:'autoEmbassy',  interval:20, offset:19,  override:false},

            // every minute, schedule == 10%20 to avoid both above
            {fn:'autoExplore',  interval:300, offset:70,  override:false},
            {fn:'autoUnicorn',  interval:300, offset:130, override:false},
            {fn:'autoBCoin',    interval:300, offset:230, override:false},

            // every 90 seconds, because KG does 80, but that timing bothers me
            {fn:'autoSave',     interval:450, offset:90, override:false},
        ]

        // This function keeps track of the game's ticks and uses math to execute these functions at set times relative to the game.
        // Offsets are staggered to spread out the load. (Not that there is much).
        this.runAllAutomation = setInterval(this.taskRunner.bind(this), 200);
    }

    halt() {
        clearInterval(this.runAllAutomation);
    }

    taskRunner() {
        if (game.isPaused) return; // we pause too
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
        game.msg('Your current efficiency is ' + parseFloat(curEfficiency).toFixed(2) + ' Paragon per hour.');
    }

    energyReport() {
        // TODO solar panels
        // "solarFarmRatio" -- PV is 0.5
        // "summerSolarFarmRatio" -- challenge: 0.05
        // "solarFarmSeasonRatio" -- thinFilm:1, qdot:1
        // game.bld.getBuildingExt("pasture").get("calculateEnergyProduction")(game, currentSeason)
        //      - base: 2, 3 with PV
        //      0. spring: 1.00 * sFSR:{1,1,1.30}
        //      1. summer: 1.33 * (summer)
        //      2. autumn: 1.00 * sFSR:{1,1,1.30}
        //      3. winter: 0.75 * sFSR:{1, 1.15, 1.30}
        // Looks like:
        //  season 3: no change
        //
        //
        //
        var total = {};
        for (var effect of ['energyProduction', 'energyConsumption']) {
            var sign = effect == 'energyProduction' ? '+' : '-';
            total[effect] = 0;
            for (var source of [game.bld.buildingsData, game.space.planets, game.time.chronoforgeUpgrades, game.time.voidspaceUpgrades]) {
                for (var shim of source) {
                    shim = shim.buildings ? shim.buildings : [shim]
                    for (var building of shim) {
                        var stage = building.stage ? building.stages[building.stage] : building;
                        if (! stage.effects || building.val == 0) continue;
                        var eper = stage.effects[effect];
                        if (building.name == 'pasture' && effect == 'energyProduction') {
                            // deal with Solar Farms. Peak is in summer(1), Low in winter(3). Report low, mention high.
                            var cep = building.stages[building.stage].calculateEnergyProduction;
                            eper = cep(game, 3);
                            total.summer = (cep(game, 1) - eper) * building.on;
                        }
                        if (eper) {
                            console.log(`${stage.label} (${building.on}/${building.val}): ${sign}${eper * building.on}`);
                            total[effect] += eper * building.on;
                        }
                    }
                }
            }
        }
        console.log(total);
        return total;
    }

    ensureContentExists(tabId) {
        // only work for visible tabs
        var tab = game.tabs.find(function(tab){return tab.tabId==tabId});
        if (! tab.visible) return false;

        var doRender = false;
        switch(tabId) {
            case 'Science':
                doRender = (tab.buttons.length == 0 || ! tab.policyPanel);
                break;
            case 'Workshop':
                doRender = (tab.buttons.length == 0);
                break;
            case 'Trade':
                doRender = (tab.racePanels.length == 0 || ! tab.exploreBtn);
                break;
            case 'Religion':
                doRender = (tab.zgUpgradeButtons.length == 0 && game.bld.get('ziggurat').on > 0
                    || tab.rUpgradeButtons.length == 0 && !game.challenges.isActive("atheism"));
                // ctPanel is set during constructor, if it's not there we're pooched
                break;
            case 'Space':
                doRender = (! tab.planetPanels || ! tab.GCPanel);
                if (tab.planetPanels) {
                    var planetCount = 0
                    for (var planet of game.space.planets) {
                        if (planet.unlocked) planetCount += 1;
                    }
                    doRender ||= tab.planetPanels.length < planetCount;
                }
                break;
            case 'Time':
                doRender = (! tab.cfPanel.children[0].children[0].model || ! tab.vsPanel.children[0].children[0].model);
                // both cfPanel and vsPanel are created in constructor.
                break;
            default:
                console.error(`ensureContentExists(${tab}) isn't handled.`);
                break;
        }

        if (doRender) {
            // create and get DOM element
            var div = $(`div.tabInner.${tabId}`)[0];
            var oldTab = null;
            if (! div) {
                oldTab = game.ui.activeTabId;
                game.ui.activeTabId = tabId;
                game.ui.render();
                div = $(`div.tabInner.${tabId}`)[0];
            }

            tab.render(div);
            console.log(`[DEBUG] rendering children of ${tabId}`);

            if (oldTab) {
                game.ui.activeTabId = oldTab;
                game.ui.render();
            }
        }

        // For things we need to do post-render()
        switch(tabId) {
            case 'Time':
                // cfPanel only becomes "visible" on an update()
                if (!game.timeTab.cfPanel.visible && game.workshop.get("chronoforge").researched) game.timeTab.update();
                break;
        }
    }

    /*** Individual Auto Scripts start here ***/
    /*** These scripts run every tick ***/

    // Collection of Minor Auto Tasks
    autoNip(ticksPerCycle) {
        if (this.model.auto.build && game.bld.get('field').val < 20) {
            $(`.btnContent:contains(${$I('buildings.gatherCatnip.label')})`).trigger('click');
        }
        if (this.model.auto.craft && game.bld.get('workshop').val < 1 && game.bld.get('hut').val < 5) {
            if (game.bldTab.buttons[1].model.enabled) {
                $(`.btnContent:contains(${$I('buildings.refineCatnip.label')})`).trigger('click');
            }
        }
        return false;
    }

    // Auto praise the sun
    autoPraise(ticksPerCycle) {
        if (this.model.auto.praise && game.bld.get('temple').val > 0) {
            game.religion.praise();
        }
    }

    // Build buildings automatically
    autoBuild(ticksPerCycle) {
        var built = false;
        if (this.model.auto.build && game.ui.activeTabId == 'Bonfire') {
            var cb = this.model.cathBuildings;
            for (var button of game.bldTab.buttons) {
                if (! button.model.metadata) continue;
                var name = button.model.metadata.name;
                if (button.model.enabled && cb[name].enabled
                        && (!cb[name].limit || button.model.metadata.val < cb[name].limit)) {
                    button.controller.buyItem(button.model, {}, function(result) {
                        if (result) {built = true; button.update();}
                    });
                }
            }
        }
        // if (built) game.render(); // update tooltip, is kinda slow
        return built;
    }

    /*** These scripts run every three ticks ***/

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
        if (this.model.auto.craft && game.workshopTab.visible) {
            for (var res of game.workshop.crafts) {
                var output = res.name;
                var inputs = res.prices;
                var outRes = game.resPool.get(output);
                if (! res.unlocked) continue;
                if (outRes.type != 'common') continue; // mostly to prevent relic+tc->bloodstone

                var craftCount = Infinity;
                var minimumReserve = Infinity;
                for (var input of inputs) {
                    var inRes = game.resPool.get(input.name);
                    var outVal = outRes.value / game.getCraftRatio(outRes.tag);
                    var inVal = inRes.value / input.val;
                    craftCount = Math.min(craftCount, Math.floor(inVal)); // never try to use more than we have

                    if (inRes.maxValue != 0) {
                        // primary resource
                        var resourcePerCycle = game.getResourcePerTick(input.name, 0) * ticksPerCycle;
                        if (inRes.value >= (inRes.maxValue - resourcePerCycle) || resourcePerCycle >= inRes.maxValue) {
                            craftCount = Math.min(craftCount, resourcePerCycle / input.val);
                        } else {
                            craftCount = 0;
                        }
                    } else if (this.model.books.includes(output) && this.model.option.book != 'default') {
                        // secondary resource: fur, parchment, manuscript, compendium
                        var outputIndex = this.model.books.indexOf(output);
                        var choiceIndex = this.model.books.indexOf(this.model.option.book);
                        if (outputIndex > choiceIndex) craftCount = 0;
                    } else {
                        // secondary resource: general
                        var inMSRR = inVal * (this.model.option.maxSecResRatio / 100);
                        if (outVal > inMSRR) {
                            craftCount = 0;
                        } else {
                            craftCount = Math.min(craftCount, inMSRR - outVal);
                        }
                    }
                    // for when our capacity gets large compared to production
                    minimumReserve = Math.min(minimumReserve, inVal * (this.model.option.minSecResRatio / 100) - outVal);
                }

                craftCount = Math.max(craftCount, minimumReserve);
                if (craftCount == 0 || craftCount == Infinity) {
                    // nothing to do, or no reason to act
                } else if (this.model.option.book == 'blueprint' && output == 'compedium' && game.resPool.get('compedium').value > 25) {
                    // save science for making blueprints
                } else {
                    game.craft(output, craftCount);
                }
            }
        }
        return false; // we scale action to need, re-run never required
    }

    autoMinor(ticksPerCycle) {
        if (this.model.minor.feed) {
            if (game.resPool.get('necrocorn').value >= 1 && game.diplomacy.get('leviathans').unlocked) {
                var energy = game.diplomacy.get('leviathans').energy || 0;
                if (energy < game.diplomacy.getMarkerCap()) {
                    game.diplomacy.feedElders();
                }
            }
        }
        if (this.model.minor.observe) {
            var checkObserveBtn = document.getElementById('observeBtn');
            if (checkObserveBtn) checkObserveBtn.click();
        }
        if (this.model.minor.promote) {
            var leader = game.village.leader;
            if (leader) {
                var expToPromote = game.village.getRankExp(leader.rank);
                var goldToPromote = 25 * (leader.rank + 1);
                if (leader.exp >= expToPromote && game.resPool.get('gold').value >= goldToPromote) {
                    if (game.village.sim.promote(leader) > 0) {
                        var census = game.villageTab.censusPanel.census;
                        census.renderGovernment(census.container);
                        census.update();
                    }
                }
            }
        }
    }

    // Hunt automatically
    autoHunt(ticksPerCycle) {
        if (this.model.auto.hunt && game.villageTab.visible) {
            var catpower = game.resPool.get('manpower');
            if (catpower.value > (catpower.maxValue - 1)) {
                game.village.huntAll();
            }
        }
        return false; // we huntAll(), should never need to run again
    }

    /*** These scripts run every game day (2 seconds) ***/

    // Build space stuff automatically
    autoSpace(ticksPerCycle) {
        var built = false;
        if (this.model.auto.build && game.spaceTab.visible) {
            this.ensureContentExists('Space');

            // Build space buildings
            var sb = this.model.spaceBuildings;
            for (var planet of game.spaceTab.planetPanels) {
                for (var spBuild of planet.children) {
                    if (sb[spBuild.id].enabled && game.space.getBuilding(spBuild.id).unlocked
                            && (!sb[spBuild.id].limit || spBuild.model.metadata.val < sb[spBuild.id].limit)) {
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
        }

        // Build space programs
        if (this.model.minor.program && game.spaceTab.visible) {
            this.ensureContentExists('Space');
            for (var program of game.spaceTab.GCPanel.children) {
                if (program.model.metadata.unlocked && program.model.on == 0) {
                    if (! program.model.enabled) program.controller.updateEnabled(program.model);
                    if (program.model.enabled) {
                        program.controller.buyItem(program.model, {}, function(result) {
                            if (result) {built = true; program.update();}
                        });
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
            this.ensureContentExists('Religion');
            this.ensureContentExists('Time');

            // TODO: special case for Markers and Tears
            var tb = this.model.timeBuildings;
            for (var buttons of buttonGroups) {
                if (buttons) {
                    for (var button of buttons) {
                        if (tb[button.id]?.enabled && button.model.metadata.unlocked
                                && (!tb[button.id].limit || button.model.metadata.val < tb[button.id].limit)) {
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

    // Festival automatically
    autoParty(ticksPerCycle) {
        if (this.model.auto.party && game.science.get('drama').researched && game.villageTab.visible) {
            var catpower = game.resPool.get('manpower').value;
            var culture = game.resPool.get('culture').value;
            var parchment = game.resPool.get('parchment').value;

            if (catpower > 1500 && culture > 5000 && parchment > 2500) {
                if (game.prestige.getPerk('carnivals').researched && game.calendar.festivalDays < 400*10) {
                    game.village.holdFestival(1);
                } else if (game.calendar.festivalDays == 0) {
                    game.village.holdFestival(1);
                }
            }
        }
        return false; // there is never a need to re-run
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
            } else if (this.model.power.biolab.val > this.model.power.biolab.on && proVar > (conVar + 3)) {
                this.model.power.biolab.on++;
                conVar++;
            } else if (this.model.power.biolab.on > 0 && proVar < conVar) {
                this.model.power.biolab.on--;
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

    /*** These scripts run every 4 seconds ***/

    smartAssign() {
        if (game.calendar.day < 0) return false; // temporal paradox messes up the cache
        var limits={};
        var kittens = game.village.getKittens();
        var fugit = game.time.isAccelerated ? 1.5 : 1;

        // Default Job Ratio. Will try to aim for this.
        var jobRatio = {
            'farmer':    0.05,
            'woodcutter':0.20,
            'miner':     0.20,
            'geologist': 0.20,
            'hunter':    0.15,
            'scholar':   0.10,
            'priest':    0.10,
        };

        // first calculate (and enforce) "hard" limits:
        for (var job of game.village.jobs) {
            // We need a better way of finding out what a kitten produces in each job
            var res = null;
            var ticksToFull = null;
            if (job.value === 0) continue; // can't calculate
            switch(job.name) {
                case 'farmer':
                    // no limit.
                    break;
                case 'woodcutter':
                    res = game.resPool.get('wood');
                    ticksToFull = 3; // Limit production to what autoCraft can consume
                    break;
                case 'miner':
                    res = game.resPool.get('minerals');
                    ticksToFull = 3; // As Lumbercats
                    break;
                case 'geologist':
                    var ironPerTick = game.resPool.get('iron').perTickCached;
                    var coalPerTick = game.resPool.get('coal').perTickCached;
                    limits[job.name] = Math.round((ironPerTick * (2 / 3) / coalPerTick) * job.value);
                    break;
                case 'hunter':
                    res = game.resPool.get('manpower');
                    if (!sk.model.auto.hunt && res.value >= res.maxValue) limits[job.name] = 1;
                    else ticksToFull = 10;
                    break;
                case 'scholar':
                    res = game.resPool.get('science');
                    if (res.value >= res.maxValue) limits[job.name] = 1;
                    else ticksToFull = 20;
                    break;
                case 'priest':
                    // no hard limit, excess goes here
                    break;
            }
            if (res && ticksToFull) {
                var perKittenSec = res.perTickCached * fugit * 5 / job.value;
                if (perKittenSec > 0) {
                    limits[job.name] = Math.round((res.maxValue / perKittenSec) / (ticksToFull / 5));
                }
            }
            if (limits[job.name] && job.value > limits[job.name]) {
                game.village.sim.removeJob(job.name, job.value - limits[job.name]);
            }
        }

        /**
         * As a general guideline, smartAssign should only "assign" kittens to
         * jobs, not remove them. However, we make some exceptions:
         *     1. (above) if there are so many in a job that resources are going to waste
         *     2. (above) we're at science or hunting cap
         *     3. (this) if we're starving, or a job has less than half expected
         *         - this last point means the player the player can't allocate more than ~60%
         * Note: assignJob and removeJob are fairly slow functions, because
         * they try to "optimize" kittens, (which mostly means adding the most
         * skilled and removing the least skilled) so we try to batch assign/remove.
         **/

        // find jobs with less than half target
        var needs = {};
        for (var job of game.village.jobs) {
            var minimum = Math.floor(jobRatio[job.name] * kittens / 2);
            if (limits[job.name]) minimum = Math.min(minimum, limits[job.name]);
            if (job.value < minimum) needs[job.name] = minimum - job.value;
            if (job.name === 'farmer' && game.resPool.get('catnip').perTickCached < 0) {
                needs[job.name] ||= 1; // if we're starving, add a farmer
            }
        }

        // try to satisfy from free kittens
        var avails = game.village.getFreeKittens();
        var totalNeed = 0;
        for (var need in needs) totalNeed += needs[need];

        // figure current distribution
        var distribution = []; // [0:name, 1:count, 2:expected, 3:count/expected]
        for (var job of game.village.jobs) {
            if (job.value === 0) continue;
            distribution.push([job.name, job.value, kittens * jobRatio[job.name], job.value/kittens * jobRatio[job.name]]);
        }
        distribution.sort(function(a,b){return b[3] - a[3];});

        // allocate necessary losses to the most over-allocated
        untilNeed: while (avails < totalNeed) {
            for (var i=0; i<distribution.length; i+=1) {
                if (i+1 >= distribution.length || distribution[i][3] > distribution[i+1][3]) {
                    distribution[i][1] -= 1;
                    distribution[i][3] = distribution[i][1] / distribution[i][2];
                    totalNeed -= 1;
                    continue untilNeed;
                }
            }
            console.log("UH OH!");
            break; // this should not be possible, but infinite loops are really bad
        }
        // lose them
        for (var job of game.village.jobs) {
            for (var i=0; i<distribution.length; i+=1) {
                if (job.name !== distribution[i][0]) continue;
                var sack = job.value - distribution[i][1];
                if (sack > 0) {
                    game.village.sim.removeJob(job.name, sack);
                    avails += sack;
                }
            }
        }

        // do the needful
        for (var job of game.village.jobs) {
            var need = needs[job.name];
            if (need) {
                game.village.assignJob(job, need);
                avails -= need;
                for (var i=0; i<distribution.length; i+=1) {
                    if (job.name !== distribution[i][0]) continue;
                    distribution[i][1] += need;
                    distribution[i][3] = distribution[i][1] / distribution[i][2];
                }
            }
        }

        // use up any remaining space
        delete distribution['farmer'];
        distribution.reverse();
        distribution = distribution.filter(function(x){
            return x[0] !== 'farmer' && (!limits[x[0]] ||  x[1] < limits[x[0]]);
        });
        untilAvail: while (avails > 0) {
            for (var i=0; i<distribution.length; i+=1) {
                if (i+1 >= distribution.length || distribution[i][3] < distribution[i+1][3]) {
                    distribution[i][1] += 1;
                    avails -= 1; // haven't done it yet, it's in "add them"
                    distribution[i][3] = distribution[i][1] / distribution[i][2];
                    if (distribution[i][1] >= limits[distribution[i][0]]) {
                        distribution = distribution.filter(function(x){return !limits[x[0]] ||  x[1] < limits[x[0]];});
                    }
                    continue untilAvail;
                }
            }
            console.log("UH OH!");
            break; // this should not be possible, but infinite loops are really bad
        }
        // add them
        for (var job of game.village.jobs) {
            for (var i=0; i<distribution.length; i+=1) {
                if (job.name !== distribution[i][0]) continue;
                var hire = distribution[i][1] - job.value;
                if (hire) game.village.assignJob(job, hire);
            }
        }
        return false
    }

    // Auto assign new kittens to selected job
    autoAssign(ticksPerCycle) {
        var assigned = false;
        if (this.model.auto.assign && game.villageTab.visible) {
            if (this.model.option.assign === 'smart') {
                assigned = this.smartAssign();
            } else if (game.village.getJob(this.model.option.assign).unlocked && game.village.hasFreeKittens()) {
                game.village.assignJob(game.village.getJob(this.model.option.assign), 1);
                assigned = true;
            }
        }
        return assigned;
    }

    // Auto Research
    autoResearch(ticksPerCycle) {
        if (this.model.auto.research && game.libraryTab.visible) {
            this.ensureContentExists('Science');
            return this.autoTechHelper(game.libraryTab.buttons);
        }
        return false;
    }

    // Auto buy workshop upgrades
    autoWorkshop(ticksPerCycle) {
        if (this.model.auto.workshop && game.workshopTab.visible) {
            this.ensureContentExists('Workshop');
            return this.autoTechHelper(game.workshopTab.buttons);
        }
        return false;
    }

    autoTechHelper(buttons) {
        var acted = false;
        var science = game.resPool.get('science').value;
        var bestButton = null;
        var bestCost = Infinity;
        techloop: for (var button of buttons) {
            if (button.model.metadata.researched || ! button.model.metadata.unlocked) continue;
            var cost = 0;
            for (var price of button.model.prices) {
                if (price.name == 'science') {
                    cost = price.val;
                } else if (this.model.minor.conserveExotic && this.model.exoticResources.includes(price.name)) {
                    continue techloop;
                }
            }
            if (cost < science && cost < bestCost) {
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
        return acted;
    }

    // Auto buy religion upgrades
    autoReligion(ticksPerCycle) {
        var bought = false;
        var futureBuy = false;
        if (this.model.auto.religion && game.religionTab.visible) {
            this.ensureContentExists('Religion');

            for (var button of game.religionTab.rUpgradeButtons) {
                if (! button.model.enabled) button.update();
                if (button.model.enabled) {
                    button.controller.buyItem(button.model, {}, function(result) {
                        if (result) { bought = true; button.update(); }
                    });
                }
                // only things with a priceRatio cap, check if they have
                futureBuy ||= (button.model.metadata.priceRatio && ! button.model.resourceIsLimited)
            }
            if (! futureBuy && this.model.minor.praiseAfter && ! this.model.auto.praise) {
                sk.gui.autoSwitch('praise', 'SK_autoPraise');
            }
        }
        return bought;
    }

    // Trade automatically
    autoTrade(ticksPerCycle) {
        var traded = false;
        if (this.model.auto.trade && game.diplomacyTab.visible) {
            var goldResource = game.resPool.get('gold');
            var goldPerCycle = game.getResourcePerTick('gold') * ticksPerCycle;
            var powerResource = game.resPool.get('manpower');
            var powerPerCycle = game.getResourcePerTick('manpower') * ticksPerCycle;
            var powerPerCycle = Math.min(powerPerCycle, powerResource.value); // don't try to spend more than we have
            var sellCount = Math.floor(Math.min(goldPerCycle/15, powerPerCycle/50));

            // TODO: capping gold can take too long, use SRS to compensate
            // fuck that noise. Write a proper autoTrade, with per civ toggles in the Options menu
            if (goldResource.value > (goldResource.maxValue - goldPerCycle)) { // don't check catpower
                var tiRes = game.resPool.get('titanium');
                var unoRes = game.resPool.get('unobtainium');

                if (unoRes.value > 5000 && game.diplomacy.get('leviathans').unlocked) {
                    game.diplomacy.tradeAll(game.diplomacy.get('leviathans'));
                    traded = true;
                } else if (tiRes.value < (tiRes.maxValue * 0.9) && game.diplomacy.get('zebras').unlocked) {
                    // don't waste the iron, make some space for it.
                    var ironRes = game.resPool.get('iron');
                    var sellIron = game.diplomacy.get('zebras').sells[0];
                    var expectedIron = sellIron.value * sellCount *
                        (1 + (sellIron.seasons ? sellIron.seasons[game.calendar.getCurSeason().name] : 0)) *
                        (1 + game.diplomacy.getTradeRatio() + game.diplomacy.calculateTradeBonusFromPolicies('zebras', game));
                    if (ironRes.value > (ironRes.maxValue - expectedIron)) {
                        game.craft('plate', (ironRes.value - (ironRes.maxValue - expectedIron))/125); // 125 is iron per plate
                    }

                    // don't overdo it
                    var deltaTi = tiRes.maxValue - tiRes.value;
                    var expectedTi = game.resPool.get('ship').value * 0.03;
                    sellCount = Math.ceil(Math.min(sellCount, deltaTi / expectedTi));
                    game.diplomacy.tradeMultiple(game.diplomacy.get('zebras'), sellCount);
                    traded = true;
                }
            }
        }
        return traded;
    }

    // auxiliary function for autoShatter
    autoDoShatter(years) {
        // limit to 5 years per tick, mostly to allow crafting time
        var timeslip = false;
        if (years > 5) {
            years = 5;
            timeslip = true;
        }

        // mass craft
        var shatterTCGain = game.getEffect('shatterTCGain') * (1 + game.getEffect('rrRatio'));
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
            this.ensureContentExists('Time');
            if (game.timeTab.cfPanel.visible && game.calendar.day >= 0) { // avoid shattering DURING paradox
                var startOfSeason = game.calendar.day * game.calendar.ticksPerDay < 3 * ticksPerCycle;
                var lowHeat = game.time.heat < Math.max(5, ticksPerCycle * game.getEffect('heatPerTick'));
                var startStorm = shattering || (this.model.minor.wait4void ? startOfSeason : true) && lowHeat;

                // find length of shatter storm
                var shatter = 0;
                if (this.model.auto.shatter && startStorm) {
                    // how many shatters worth of heat can we afford?
                    var factor = game.challenges.getChallenge('1000Years').researched ? 5 : 10;
                    var shatter = Math.ceil((game.getEffect('heatMax') - game.time.heat) / factor);
                }

                // adjust to end in the right cycle
                var cyclename = this.model.option.cycle;
                var cycle = game.calendar.cycles.findIndex(function(c){return c.name == cyclename});
                if (this.model.auto.cycle && game.calendar.cycle != cycle) {
                    // desired cycle: sk.model.option.cycle
                    // current cycle: game.calendar.cycle
                    // year in cycle: game.calendar.cycleYear
                    var deltaCycle = (cycle - game.calendar.cycle + game.calendar.cycles.length) % game.calendar.cycles.length;
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

    // Build Embassies automatically
    autoEmbassy(ticksPerCycle) {
        // TODO: something in this function is damaging responsiveness
        var built = false;
        if (this.model.auto.embassy && game.science.get("writing").researched && game.diplomacyTab.racePanels && game.diplomacyTab.racePanels[0]) {
            var culture = game.resPool.get('culture');
            if (culture.value >= culture.maxValue * 0.99) { // will often exceed due to MS fluctuations
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

    /*** These scripts run every minute ***/

    // Explore for new Civs
    autoExplore(ticksPerCycle) {
        var available = false;
        if (this.model.auto.explore && game.diplomacyTab.visible && game.resPool.get('manpower').value >= 1000) {
            this.ensureContentExists('Trade');

            for (var race of game.diplomacy.races) {
                if (race.unlocked) continue;
                switch(race.name) {
                    case 'lizards': case 'sharks': case 'griffins':
                        available = true;
                        break;
                    case 'nagas':
                        available = game.resPool.get('culture').value >= 1500;
                        break;
                    case 'zebras':
                        available = game.resPool.get('ship').value >= 1;
                        break;
                    case 'spiders':
                        available = game.resPool.get('ship').value >= 100 && game.resPool.get('science').maxValue > 125000;
                        break;
                    case 'dragons':
                        available = game.science.get('nuclearFission').researched;
                        break;
                    case 'leviathans':
                        break;
                    default:
                        console.log(`WARNING: unrecognized race: ${race.name} in minor/Explore`);
                }
                if (available) break;
            }
            if (available) {
                var button = game.diplomacyTab.exploreBtn;
                button.controller.buyItem(button.model, {}, function(result) {
                    if (result) {
                        available = true;
                        game.diplomacyTab.render($('div.tabInner.Trade')[0]); // create race panel
                    }
                });
            }
        }
        return available;
    }

    // Auto buy unicorn upgrades
    autoUnicorn(ticksPerCycle) {
        var acted = false;
        if (this.model.auto.unicorn && game.religionTab.visible) {
            this.ensureContentExists('Religion');

            /* About Unicorn Rifts
             * Each Tower causes a 0.05% chance for a rift per game-day
             * Each rift produces 500 Unicorns * (Unicorn Production Bonus)/10
             */
            var riftUnicorns = 500 * (1 + game.getEffect('unicornsRatioReligion') * 0.1);
            var unicornChanceRatio = 1.1 * (1 + game.getEffect('timeRatio') * 0.25);
            var upsprc = riftUnicorns * unicornChanceRatio / 2; // unicorns per second per riftChance
            var ups = 5 * game.getResourcePerTick('unicorns') / (1 + game.getEffect('unicornsRatioReligion'));
            // Constants for Ivory Meteors
            var meteorChance = game.getEffect('ivoryMeteorChance') * unicornChanceRatio / 2;
            var ivoryPerMeteor = 250 + 749.5 * (1 + game.getEffect('ivoryMeteorRatio'));

            // find which is the best value
            var bestButton = null;
            var bestValue = 0.0;
            for (var button of game.religionTab.zgUpgradeButtons) {
                if (button.model.metadata.unlocked) {
                    if (! this.model.minor.unicornIvory) {
                        var tearCost = button.model.prices.find(function(element){return element.name==='tears'});
                        if (tearCost == null) continue;
                        var ratio = button.model.metadata.effects.unicornsRatioReligion;
                        var rifts = button.model.metadata.effects.riftChance || 0;
                        var value = (ratio * ups + rifts * upsprc) / tearCost.val;
                    } else {
                        var ivoryCost = button.model.prices.find(function(element){return element.name==='ivory'});
                        if (ivoryCost == null) continue;
                        var ratio = button.model.metadata.effects.ivoryMeteorRatio || 0;
                        var chance = button.model.metadata.effects.ivoryMeteorChance || 0;
                        value = (meteorChance * ratio * 749.5 + chance * unicornChanceRatio/2 * ivoryPerMeteor) / ivoryCost.val;
                    }
                    if (value > bestValue) {
                        bestButton = button;
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
                    var zigs = game.bld.get('ziggurat').on;
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

    // Auto buys and sells bcoins optimally
    autoBCoin(ticksPerCycle) {
        // When the price is > 1100 it loses 20-30% of its value
        // 880+ε is the highest it could be after an implosion
        if (this.model.auto.bcoin && game.diplomacy.get('leviathans').unlocked && game.resPool.get('relic').value > 0) {
            var eldersPanel = game.diplomacyTab.racePanels.find(function(p){return p.race.name == 'leviathans'});
            if (! eldersPanel || ! eldersPanel.buyBcoin) return false;
            if (game.calendar.cryptoPrice < 1090) {
                game.diplomacy.buyBcoin();
            } else if (game.resPool.get('blackcoin').value > 0) {
                game.diplomacy.sellBcoin();
            }
        }
        return false;
    }

    // Automatically use flux for fixing CCs and tempus fugit
    autoFlux(ticksPerCycle) {
        if (this.model.auto.flux && game.timeTab.visible) {
            var flux = game.resPool.get('temporalFlux').value;
            var reserve = 10000 + 2 * ticksPerCycle; // actual is 9500; round numbers and margin of error
            var fixcost = 3000;
            var forfugit = game.time.heat / game.getEffect('heatPerTick');
            if (flux > reserve + forfugit + fixcost) {
                this.fixCryochamber();
                if (flux > 0) game.time.isAccelerated = true;
            } else if (flux > reserve) {
                // clicking the toggle-switch is HARD, this is fine as long as flux > 0
                if (flux > 0) game.time.isAccelerated = true;
            } else {
                game.time.isAccelerated = false;
            }
            this.model.managedFugit = game.time.isAccelerated;
        } else if (this.model.managedFugit) {
            // if it was turned off while Fugit was on, turn off Fugit
            game.time.isAccelerated = false;
            this.model.managedFugit = false;
        }
        return false;
    }

    fixCryochamber() {
        var button = game.timeTab.vsPanel.children[0].children[0];
        if (button.model) {
            button.controller.buyItem(button.model, {}, function(result) {
                if (result) button.update();
            });
        }
    }

    autoPlay(ticksPerCycle) {
        if (this.model.auto.play) {
            this.scripts.run(this.model.option.script);
        }
    }

    autoSave(ticksPerCycle) {
        sk.saveOptions();
    }
}

/**
 * These are the autoPlay scripts. Highly Experimental
 **/
SK.Scripts = class {
    constructor(model) {
        this.model = model;
        this.init();
    }

    init() {
        this.state = ['init'];
    }

    save(options) {
        options.scripts_state = this.state;
    }

    load(options) {
        if (options.scripts_state) this.state = options.scripts_state;
    }


    static listScripts() {
        return [ // format is chosen to match things like game.calendar.cycles
            {name:'test',        title:'Test Script'},
            {name:'startup',     title:'Post Chrono Setup'},
            {name:'fastParagon', title:'Fast Reset'},
            {name:'chronoloop',  title:'Chrono Reset'},
            {name:'hoglagame',   title:'Hoglagame'},
        ];
    }

    run(script) {
        if (this.state.length == 0) return;

        // prep
        var oldConfirm = game.ui.confirm; // for policies and building upgrades
        game.ui.confirm = this.alwaysYes;

        // action
        var action = this.state.shift();
        console.log(`Doing ${action}  --  [${this.state}]`);
        var done = this[script](action);
        if (done) {
            sk.gui.refresh();
        } else {
            this.state.push(action);
        }

        // cleanup
        if (action != 'init') { // init is allowed to change tab
            game.ui.confirm = oldConfirm;
        }
    }

    alwaysYes(title, msg, fn) {
        fn();
    }

    singleBuild(building) {
        var built = false;
        for (var button of game.bldTab.buttons) {
            if (button.model.metadata?.name != building) continue;
            if (button.model.enabled) {
                button.controller.buyItem(button.model, {}, function(result) {
                    if (result) {built = true; button.update();}
                });
            }
        }
        return built;
    }

    singleTech(buttons, targets) {
        var count = 0;
        for (var button of buttons) {
            if (! button.model.metadata.unlocked) continue;
            if (targets.includes(button.model.metadata.name)) {
                if (button.model.metadata.researched) {
                    count += 1;
                } else {
                    button.controller.buyItem(button.model, {}, function(result) {
                        if (result) button.update();
                    });
                    return false;
                }
            }
        }
        return count == targets.length;
    }

    startup(action) {
        // TODO:
        // 1. make sure all tabs work properly in background
        // 2. should not auto-trade until chronos are capped
        switch(action) {
            case 'init': // -> workshop-start, science-start, trade-zebras, trade-hunt
                this.model.auto.bcoin = true;
                this.model.auto.explore = true;
                this.model.auto.flux = true;
                this.model.auto.party = true;
                this.model.auto.unicorn = true;
                this.model.minor.program = true;
                this.model.minor.feed = true;
                this.model.minor.promote = true;
                this.model.minor.praiseAfter = true;
                this.state.push('workshop-start');
                this.state.push('science-start');
                this.state.push('trade-zebras');
                this.state.push('trade-hunt');
                game.ui.activeTabId = 'Bonfire';
                game.render();
                return true;

            case 'workshop-start': // -> workshop-mid
                if (game.bld.get('workshop').val != 0 || this.singleBuild('workshop')) {
                    this.model.auto.workshop = true;
                    this.state.push('workshop-end');
                    return true;
                }
                return false;

            case 'workshop-end': // -|
                var extraUpgrades = ['chronoforge', 'turnSmoothly', 'amBases', 'aiBases'];
                if (this.singleTech(game.workshopTab.buttons, extraUpgrades)) {
                    this.model.auto.workshop = false;
                    this.model.minor.conserveExotic = false;
                    return true;
                }
                return false;

            case 'science-start': // -> build-upgrade, policy, science-end
                this.model.auto.research = true;
                this.state.push('build-upgrade');
                this.state.push('policy');
                this.state.push('science-end');
                return true;

            case 'science-end': // -|
                var extraTechs = [ 'tachyonTheory', 'voidSpace', 'paradoxalKnowledge', 'antimatter' ];
                return this.singleTech(game.libraryTab.buttons, extraTechs);

            case 'build-upgrade': // -> build-start
                var techs = ['electronics', 'ecology', 'robotics'];
                if (techs.every(function(tech){return game.science.get(tech).researched})) {
                    this.state.push('build-start');
                    return true;
                }
                return false;

            case 'build-start': // -> religion, steamworks, build-end
                /** cath **/
                var climit = {
                    'library': 200, // actually data center
                    'observatory':1000,
                    'warehouse':200,
                    'harbor':200,
                    'quarry':200,
                    'oilWell':200,
                    'calciner':200,
                    'magneto':150,
                    'steamworks':150,
                    'ziggurat':100,
                    'aiCore':60,
                };
                for (var bname in this.model.cathBuildings) {
                    if (bname.slice(0,5) == 'zebra') continue;
                    this.model.cathBuildings[bname].enabled = true;
                }
                for (var bname in climit) this.model.cathBuildings[bname].limit = climit[bname];
                /** upgrade all buildings **/
                for (var button of game.bldTab.buttons) {
                    if (button.controller.upgrade && button.model.metadata.stage < button.model.metadata.stages.length - 1) {
                        button.controller.upgrade(button.model);
                    }
                }
                /** space **/
                var space = [
                    'sattelite', 'moonOutpost', 'moonBase',
                    'planetCracker', 'hydrofracturer', 'spiceRefinery',
                    'sunforge', 'cryostation',
                ];
                for (var bname of space) this.model.spaceBuildings[bname].enabled = true;
                var slimit = { 'sunforge':20, }
                for (var bname in slimit) this.model.spaceBuildings[bname].limit = slimit[bname];
                /** time **/
                var time = [ 'marker', 'blackPyramid' ];
                for (var bname of time) this.model.timeBuildings[bname].enabled = true;
                this.model.auto.build = true;
                /** children **/
                this.state.push('religion');
                this.state.push('steamworks');
                this.state.push('build-end');
                return true;

            case 'build-end': // -> time-start
                /// XXX TODO: I believe the right time to switch to RRs is when
                //  XXX TODO: all of wood, minerals, ???, and UO are under their max
                //  XXX TODO: watch a run and check
                //  Extension: do the chrono->elevator swap when CS is capped
                //  And Then: do the storage->shatter check based on wood/minerals after that
                for (var button of game.bldTab.buttons) {
                    if (game.calendar.year > game.calendar.darkFutureBeginning) break;
                    if (button.model.metadata?.name != 'chronosphere') continue;
                    if (button.model.resourceIsLimited != true) return false; // not capped yet
                    break;
                } // XXX sequencing is wrong, elevators speed up Chronos...
                var lateSpace = ['spaceElevator', 'orbitalArray', /*'hydroponics' XXX AM */];
                for (var bname of lateSpace) this.model.spaceBuildings[bname].enabled = true;
                this.model.auto.craft = true;
                this.state.push('time-start');
                return true;

            case 'religion': // -> assign
                var done = false;
                sk.tasks.ensureContentExists('Religion'); // create button
                var button = game.religionTab.rUpgradeButtons.find(function(b){return b.model.metadata.name == 'solarRevolution'});
                if (button.model.metadata.val > 0) {
                    done = true; // someone already got it
                } else {
                    if ( ! button.model.enabled) button.update();
                    if (button.model.enabled) {
                        button.controller.buyItem(button.model, {}, function(result) {
                            if (result) { done = true; button.update(); }
                        });
                    }
                }
                if (done) {
                    this.model.auto.religion = true;
                    this.state.push('assign');
                }
                return done;

            case 'steamworks': // -|
                if (game.bld.get('steamworks').val != 0) {
                    game.bld.get('steamworks').on = game.bld.get('steamworks').val;
                    game.bld.get('steamworks').isAutomationEnabled = false;
                    return true;
                } else {
                    return false;
                }

            case 'policy': // -|
                var chosen = [
                    'liberty', 'republic', 'liberalism',
                    'diplomacy', 'culturalExchange', 'zebraRelationsBellicosity',
                    'outerSpaceTreaty', 'expansionism', 'necrocracy',
                    'epicurianism', 'mysticism',
                    'environmentalism', 'conservation',
                ];
                var researched = 0;
                for (var button of game.libraryTab?.policyPanel?.children) {
                    var policy = button.model.metadata;
                    if (policy.researched == true) {
                        researched += 1;
                        continue;
                    }
                    if (policy.blocked == true || policy.unlocked == false) continue;
                    if (chosen.includes(policy.name)) {
                        button.controller.buyItem(button.model, {}, function(result) {
                            if (result) button.update();
                        });
                        return false; // only try to buy one per pass
                    }
                }
                var done = (researched == chosen.length);
                return done;

            case 'assign': // -|
                if (game.village.getFreeKittens() > 0 || game.village.leader.job) {
                    game.village.assignJob(game.village.getJob('priest'), 1); // assign leader
                    this.model.auto.assign = true;
                    return true;
                }
                return false;

            case 'trade-zebras': // -|
                var zebraPanel = game.diplomacyTab?.racePanels?.find(function(panel){return panel.race.name=='zebras'});
                if (!zebraPanel) return false;
                var button = zebraPanel.embassyButton;
                while (button.model.enabled) {
                    button.controller.buyItem(button.model, {}, function(result) {
                        if (result) {button.update();}
                    });
                }
                this.model.auto.embassy = true;
                this.model.auto.trade = true;
                return true;

            case 'trade-hunt': // -|
                if (game.getEffect('hunterRatio') > 4
                        && game.calendar.festivalDays >= 400*5
                        && game.diplomacy.get('zebras').unlocked) {
                    this.model.auto.hunt = true;
                    return true;
                }
                return false;

            case 'time-start': // |-> time-mid
                if (! game.science.get('paradoxalKnowledge').researched) return false;
                if (! game.workshop.get('chronoforge').researched) return false;
                var tlimit = {
                    'temporalBattery':30,
                    'blastFurnace':37,
                    'temporalImpedance':10,
                    'ressourceRetrieval':20,
                    'chronocontrol':1
                };
                for (var bname in tlimit) {
                    this.model.timeBuildings[bname].limit = tlimit[bname];
                    this.model.timeBuildings[bname].enabled = true;
                }
                this.state.push('time-end');
                return true;

            case 'time-end':
                if (game.time.getCFU('ressourceRetrieval').val >= 20
                        && game.time.getCFU('blastFurnace').val >= 10) {
                    this.model.auto.cycle = true;
                    this.model.auto.shatter = true;
                    this.state.push('dark-future');
                    return true;
                }
                return false;

            case 'dark-future':
                if (game.calendar.year > game.calendar.darkFutureBeginning) {
                    this.model.spaceBuildings['spaceStation'].enabled = true;
                    this.model.spaceBuildings['spaceElevator'].enabled = false; // conserve UO for CS
                    this.model.auto.trade = false;
                    this.state.push('endgame');
                    return true;
                }
                return false;

            case 'endgame':
                if (game.calendar.cycle == 3) return false; // Helios cycle lowers UO cap
                for (var button of game.bldTab.buttons) {
                    if (button.model.metadata?.name != 'chronosphere') continue;
                    if (button.model.resourceIsLimited != true) return false; // not at second capped yet
                    break;
                }
                for (var auto in this.model.auto) this.model.auto[auto] = false;
                this.model.auto.play = true;
                this.model.auto.unicorn = true;
                game.time.isAccelerated = false;
                this.state.push('ensure-relics');
                return true;

            case 'ensure-relics':
                var relicsRequired = 0;
                relicsRequired += 40; // 20 sunforges
                relicsRequired += 77020; // Furnaces
                relicsRequired += 5662; // Tech/Workshop
                relicsRequired *= 1.1; // margin for error
                var relics = game.resPool.get('relic').value;
                if (relics >= relicsRequired) {
                    this.state.push('sellout');
                    return true;
                } else {
                    var button = game.religionTab.refineTCBtn;
                    var mult = game.religionTab.refineTCBtn.controller.controllerOpts.gainMultiplier.call(button);
                    button.controller._transform(button.model, Math.ceil(relicsRequired / mult))
                    return false; // run the check again next cycle
                }

            case 'sellout':
                // sac alicorns
                var button = game.religionTab.sacrificeAlicornsBtn;
                button.controller._transform(button.model, Math.floor(button.controller._canAfford(button.model)));
                // Adore, user can Transcend manually
                button = game.religionTab.adoreBtn;
                button.controller.buyItem(button.model, {}, function(result) {
                    if (result) {button.update();}
                });
                // sell a bunch of buildings, reset.
                game.msg(`Final Pre-Reset steps NYI`);
                return true;

            case 'todo':
                sell('all kinds of things');
                this.model.minor.unicornIvory = true;
                // TODO: deal with sequencing around Necrocracy and Levi arrival, and Auto Shatter.
                // markers

            default:
                this.model.auto.play = false;
                console.log(`CRITICAL: unrecognized state ${action}`);
                game.msg(`CRITICAL: unrecognized state ${action}`);
                return true; // to cause refresh
        }
    }

    fastParagon(action) {
        switch(action) {
            case 'init': // -> build-start, build-upgrade, workshop-start, trade-start, policy
                this.model.auto.explore = true;
                this.model.auto.party = true;
                this.model.auto.research = true;
                this.model.auto.unicorn = true;
                this.model.minor.program = true;
                this.model.minor.feed = true;
                this.model.minor.promote = true;
                this.model.minor.praiseAfter = true;
                game.ui.activeTabId = 'Science'; game.render();
                game.ui.activeTabId = 'Bonfire'; game.render();
                this.state.push('build-start');
                this.state.push('build-upgrade');
                this.state.push('workshop-start');
                this.state.push('trade-start');
                this.state.push('policy');
                return true;

            case 'build-start': // -> religion, steamworks, pop-max-cath
                /** cath **/
                for (var bname in this.model.cathBuildings) {
                    var limit = false;
                    switch (bname) {
                        case 'oilWell': case 'quarry': case 'harbor': case 'amphitheatre': case 'calciner':
                            limit = 100;
                            break;
                        case 'warehouse': case 'observatory': case 'lumberMill':
                            limit = 200;
                            break;
                        case 'biolab': case 'mint': case 'ziggurat': case 'aiCore':
                        case 'zebraForge': case 'zebraOutpost': case 'zebraWorkshop':
                            continue; // don't enable
                    }
                    this.model.cathBuildings[bname].enabled = true;
                    if (limit) this.model.cathBuildings[bname].limit = limit;
                }
                /** space **/
                var space = [
                    'sattelite', 'moonOutpost', 'moonBase',
                    'planetCracker', 'hydrofracturer', 'spiceRefinery',
                ];
                for (var bname of space) this.model.spaceBuildings[bname].enabled = true;
                /** turn it on **/
                this.model.auto.build = true;
                this.model.auto.assign = true;
                /** children **/
                game.ui.activeTabId = 'Religion'; game.render();
                game.ui.activeTabId = 'Space'; game.render();
                game.ui.activeTabId = 'Time'; game.render();
                this.state.push('religion');
                this.state.push('steamworks');
                this.state.push('pop-max-cath');
                return true;

            case 'build-upgrade': // -|
                var techs = ['electronics', 'ecology'];
                if (techs.every(function(tech){return game.science.get(tech).researched})) {
                    /** upgrade all buildings **/
                    for (var button of game.bldTab.buttons) {
                        if (button.controller.upgrade && button.model.metadata.stage < button.model.metadata.stages.length - 1) {
                            if (! ['pasture', 'amphitheatre'].includes(button.model.metadata.name)) continue;
                            button.controller.upgrade(button.model);
                        }
                    }
                    this.model.auto.craft = true; // we should be in far enough for this to make sense
                    return true;
                }
                return false;

            case 'workshop-start': // -|
                if (game.bld.get('workshop').val != 0 || sk.tasks.singleBuild('workshop')) {
                    game.ui.activeTabId = 'Workshop';
                    game.render();
                    this.model.auto.workshop = true;
                    return true;
                }
                return false;

            case 'religion': // -|
                var done = false;
                var button = game.religionTab.rUpgradeButtons.find(function(b){return b.model.metadata.name == 'solarRevolution'});
                if (button.model.metadata.val > 0) {
                    done = true; // someone already got it
                } else {
                    if ( ! button.model.enabled) button.update();
                    if (button.model.enabled) {
                        button.controller.buyItem(button.model, {}, function(result) {
                            if (result) { done = true; button.update(); }
                        });
                    }
                }
                if (done) {
                    this.model.auto.religion = true;
                }
                return done;

            case 'steamworks': // -|
                if (game.bld.get('steamworks').val != 0) {
                    game.bld.get('steamworks').on = game.bld.get('steamworks').val;
                    game.bld.get('steamworks').isAutomationEnabled = false;
                    return true;
                } else {
                    return false;
                }

            case 'policy': // -|
                var chosen = [
                    'liberty', 'republic', 'liberalism',
                    'diplomacy', 'culturalExchange', 'zebraRelationsBellicosity',
                    'outerSpaceTreaty', 'expansionism', 'necrocracy',
                    'epicurianism', 'mysticism',
                    'environmentalism', 'conservation',
                ];
                var researched = 0;
                if (! game.libraryTab.policyPanel) return false; // no choices yet
                for (var button of game.libraryTab.policyPanel.children) {
                    var policy = button.model.metadata;
                    if (policy.researched == true) {
                        researched += 1;
                        continue;
                    }
                    if (policy.blocked == true || policy.unlocked == false) continue;
                    if (chosen.includes(policy.name)) {
                        button.controller.buyItem(button.model, {}, function(result) {
                            if (result) button.update();
                        });
                        return false; // only try to buy one per pass
                    }
                }
                var done = (researched == chosen.length);
                return done;

            case 'trade-start': // -> trade-zebras, trade-hunt
                if (game.diplomacyTab.visible) {
                    game.ui.activeTabId = 'Trade'; game.render();
                    for (var panel of game.diplomacyTab.racePanels) {
                        if (panel.race.name == 'zebras') {
                            this.state.push('trade-zebras');
                            this.state.push('trade-hunt');
                            return true;
                        }
                    }
                }
                return false;

            case 'trade-zebras': // -|
                for (var panel of game.diplomacyTab.racePanels) {
                    if (panel.race.name != 'zebras') continue;
                    var button = panel.embassyButton;
                    if (! button.model.visible) button.controller.updateVisible(button.model);
                    if (! button.model.visible) break;
                    if (! button.model.enabled) button.controller.updateEnabled(button.model);
                    if (! button.model.enabled) {
                        this.model.auto.embassy = true;
                        this.model.auto.trade = true;
                        return true;
                    }
                    while (button.model.enabled) {
                        button.controller.buyItem(button.model, {}, function(result) {
                            if (result) {button.update();}
                        });
                    }
                    break;
                }
                return false;

            case 'trade-hunt': // -|
                if (game.getEffect('hunterRatio') > 4
                        && game.calendar.festivalDays >= 400*5
                        && game.diplomacy.get('zebras').unlocked) {
                    this.model.auto.hunt = true;
                    return true;
                }
                return false;

            case 'pop-max-cath': // -> pop-max-space
                var kittens = game.resPool.get('kittens');
                if (kittens.value == kittens.maxValue) {
                    // TODO: disable other alloy buildings
                    this.model.spaceBuildings.spaceStation.enabled = true;
                    this.state.push('pop-max-space');
                    return true;
                }
                return false;

            case 'pop-max-space': // -> endgame-stockpile
                var kittens = game.resPool.get('kittens');
                if (kittens.value == kittens.maxValue
                    && game.bld.get('chronosphere').val >= 5
                    && game.workshop.get('fluxCondensator').researched) {
                    // disable auto tech,
                    for (var auto in this.model.auto) {
                        if (auto != 'play') this.model.auto[auto] = false;
                        game.time.isAccelerated = false;
                    }
                    this.state.push('endgame-stockpile');
                    return true;
                }
                return false;

            case 'endgame-stockpile': // -> endgame-reset!
                // these two are good enough, rest tends to follow suit
                var culture = game.resPool.get('culture');
                var faith = game.resPool.get('faith');
                if (culture.value >= culture.maxValue && faith.value >= faith.maxValue) {
                    // sac alicorns
                    var button = game.religionTab.sacrificeAlicornsBtn;
                    if (button) {
                        button.controller._transform(button.model, Math.floor(button.controller._canAfford(button.model)));
                    }
                    // Adore, user can Transcend manually
                    button = game.religionTab.adoreBtn;
                    if (button) {
                        button.controller.buyItem(button.model, {}, function(result) {
                            if (result) {button.update();}
                        });
                    }
                    // sell a bunch of buildings, reset.
                    var sellAll = {'shiftKey':true};
                    var moonButton = null;
                    for (var button of game.bldTab.buttons.concat(game.spaceTab.planetPanels.reduce(function(base,pp){return base.concat(pp.children)}, []))) {
                        if (! button.model.metadata) continue;
                        if (button.model.metadata.name == 'chronosphere') continue;
                        if (button.model.metadata.name == 'moonBase') moonButton = button;
                        var sell = true;
                        for (var effect in button.model.metadata.effects) {
                            if (effect.substr(-3,3) == 'Max' || effect == 'maxKittens') {
                                sell = false;
                                break;
                            }
                        }
                        if (sell == true) button.controller.sell(sellAll, button.model);
                    }
                    // and sell Moon Bases, because it's worth it for the UO boost
                    if (sell == true) moonButton.controller.sell(sellAll, moonButton.model);
                    game.msg(`Final Pre-Reset steps NYI`);
                    // TODO: reset
                    return true;
                }
                return false;

            case 'todo':
                // TODO planning:
                //  eludium huts and microwarp reactors
                // TODO check to make sure autoassign works when not focused
                //  -> does not.
                //  workshop doesn't look good, missing something?
                //  -> check button update code
                //  space doesn't seem to update right either
                //  -> ...
                // // check others too, we want to aim for full auto
                // TODO:
                //  -> we're Iron -> Steel -> Alloy limited
                //  - maybe trade with Griffins?
                return false;

            default:
                this.model.auto.play = false;
                console.log(`CRITICAL: unrecognized state ${action}`);
                game.msg(`CRITICAL: unrecognized state ${action}`);
                return true; // to cause refresh
        }

        /*
        https://www.reddit.com/r/kittensgame/comments/hu8n43/late_game_short_runs_for_maximum_paragon_grinding/
        * This is a good guide, but needs heavy customization
        * Key: trading with Zebras for Steel->Plates
        * Most of the time is spent waiting for kittens to arrive

        My Plan:
            * Never: Mint, Ziggurat, Chronosphere (until end)
            * 10 each of four basic buildings
            * Auto Science, Auto Upgrade
            * Chapels or Temples, Solar Revolution, Praise, Auto Religion
            * 10 each of all buildings, max: Workshops, Lumber Mill, Smelter, Mine
            * Space, Moon, Dune. 10 each of Satellites, Elevators
            * Max everything, except 50 of: Observatory, Bio Lab, Warehouse, Harbour, Quarry, Oil Well

        Alternate Plan:
            * 1 chrono just to overcome early bottlenecks
            - ton of workshops, temple theology, SR
            - space, piscine, satellite
            - max out mansions/log houses/space stations while waiting for 2500 UO->CS

        Plan:Year 1:
            - enable all Cath buildings except Zebra, Mega, Mint
            - minor: program, feed, promote, praise after, disable conserve
            - enable technology/upgrade
            - manual SR -> auto religion
            -
            */

        /*
        Scripts:
            auto Science, Research, party, explore, embassy, trade
            auto build: most
            auto craft, assign
            auto explore, embassy, trade
            when ready: auto hunt
            Space, Moon, Dune
                - elevators are good, but limit to 10-20
        Notes:
            most time is spent waiting for population growth
            we can get ~600 people from just Cath housing
            another 300 from space
        */

    }

    chronoloop(action) {
        // Basics:
        //  we plan to conserve AM, Relics/BC, Void, TC
        //  Tech: 5657 R, 100 TC, 350 Void
        //      - we have ~2M BC, R/BC costs that small are irrelevant
        //      - main TC spend is on RR, this is a rounding error
        //      - void spend is for Cryo/Chronoc, if we're carrying cryo, this is mandatory
        //          - also, this gives us fugit
        //  Upgrades: 22675 AM, 64 BC, 229 TC, 2032 void, 10596 flux
        //      - that's a lot of AM, why? Mixed bag
        //          - 5000 for reactors to improve max science...
        //          - 5000 for relic stations
        //          - 7500 for AI Bases
        //          - 4000 for Void Techs
        //          - 1175 for misc garbage
        //          -> cut it all.
        //      - skip the 64 BC for IBH, we don't do that. TC is rounding
        //      - spend 750 Void/6500 Flux for Chronosurge
        //  Verdicts:
        //      - spend void freely, it's for cryo/surge
        //      - only spend AM on AI Core/Bases
        //      - spend relics freely, don't spend BC.
        //      - spend TC freely, it's peanuts
        //      - similarly avoid Space buildings that cost AM
    }

    todo() {
        // TODO
        // 1. script settings save/load
        // 2. disable [auto.play] on script change
        // 4. better book distribution on 'default'
        // 5.
    }
}

var sk;
if (game && game.bld) {
    sk = new SK();
} else { // we were loaded before the game was, wait for it.
    dojo.subscribe('game/start', function(){ sk = new SK()});
}

