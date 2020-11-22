
// These control the button statuses
var auto = {}; // Is a toggle holder. Use like ``auto.craft = true; if (auto.craft) { ...
var programBuild = false;

// These will allow quick selection of the buildings which consume energy
var bldBioLab = gamePage.bld.getBuildingExt('biolab').meta;
var bldOilWell = gamePage.bld.getBuildingExt('oilWell').meta;
var bldFactory = gamePage.bld.getBuildingExt('factory').meta;
var bldCalciner = gamePage.bld.getBuildingExt('calciner').meta;
var bldAccelerator = gamePage.bld.getBuildingExt('accelerator').meta;

// These are the assorted variables
var paperChoice = 'none';
var autoChoice = "farmer";
var cycleChoice = 0;
var minSecResRatio = 1;
var maxSecResRatio = 25;

//
var rareResources = [
    "antimatter",
    "blackcoin",
    "eludium",
    "relic",
    "temporalFlux",
    "timeCrystal",
    "unobtainium",
    "void",
];

/* These are the data structures that govern the automation scripts */
/* These are the data structures that govern the automation scripts */
/* These are the data structures that govern the automation scripts */
/* These are the data structures that govern the automation scripts */
/* These are the data structures that govern the automation scripts */


var minorOptions = {
    observe:{name:"Auto Observe", enabled:true},
    feed:{name:"Auto Feed Elders", enabled:false},
    promote:{name:"Auto Promote Leader", enabled:false},
    wait4void:{name:"Only Shatter at Season Start", enabled:false},
    religion2praise:{name:"Praise After Religion", enabled:false},
    unicornIvory:{name:"Unicorn Ivory Optimization", enabled:false},
    conserveRare:{name:"Conserve Rare Resources", enabled:true},
};

// Building lists for controlling Auto Build/Space/Time
var cathBuildings = {/* list is auto-generated, looks like:
    field:{name:"Catnip Field", enabled:false},
    ...
*/};
buildGroup(gamePage.bld.buildingsData, cathBuildings);

// Group like buildings for menu. Needs to be manual, because it's a judgement call.
var cathGroups = [
    ["Kitten Housing", ["hut", "logHouse", "mansion"]],
    ["Craft Bonuses", ["workshop", "factory"]],
    ["Production", ["field", "pasture", "mine", "lumberMill", "aqueduct", "oilWell", "quarry"]],
    ["Conversion", ["smelter", "biolab", "calciner", "reactor", "accelerator", "steamworks", "magneto"]],
    ["Science", ["library", "academy", "observatory"]],
    ["Storage", ["barn", "harbor", "warehouse"]],
    ["Culture", ["amphitheatre", "chapel", "temple"]],
    ["Other", ["tradepost", "mint", "unicornPasture", /*...*/]],
    ["Megastructures", ["ziggurat", "chronosphere", "aiCore"]],
];
// Add missing buildings to "Other"
for (name in cathBuildings) {
    if (! cathGroups.map(function(x){return x[1]}).flat().includes(name)) {
        for (var j=0; j<cathGroups.length; j++) {
            if (cathGroups[j][0] == "Other") cathGroups[j][1].push(name);
        }
    }
}

var spaceBuildings = {/*
    spaceElevator:{name:"Space Elevator", enabled:false},
    ...
*/};
var spaceGroups = [/*
    ["cath", ["spaceElevator", "sattelite", "spaceStation"]],
    ...
*/];
for (var i=0; i<gamePage.space.planets.length; i++) {
    var planet = gamePage.space.planets[i];
    spaceGroups.push([planet.label, buildGroup(planet.buildings, spaceBuildings)]);
}

var timeBuildings = {/*
    // As above, but for Ziggurats, Cryptotheology, Chronoforge, Void Space
    ...
*/};
var timeGroups = [/*
    // As above
    ...
*/];
timeGroups.push(['Ziggurats', buildGroup(gamePage.religion.zigguratUpgrades, timeBuildings)]);
timeGroups.push(['Cryptotheology', buildGroup(gamePage.religion.transcendenceUpgrades, timeBuildings)]);
timeGroups.push(['Chronoforge', buildGroup(gamePage.time.chronoforgeUpgrades, timeBuildings)]);
timeGroups.push(['Void Space', buildGroup(gamePage.time.voidspaceUpgrades, timeBuildings)]);

function buildGroup(upgrades, buildings) {
    var group = [];
    for (var i=0; i<upgrades.length; i++) {
        var data = upgrades[i];
        if (upgrades==gamePage.religion.zigguratUpgrades && data.effects.unicornsRatioReligion) continue; // covered by autoUnicorn()
        if (! data.stages) var label = data.label;
        else var label = data.stages.map(function(x){return x.label}).join(' / '); // for "Library / Data Center", etc
        buildings[data.name] = {name:label, enabled:false};
        group.push(data.name);
    }
    return group;
}

var resources = [
    [    "wood", [["catnip", 50]]],
    [    "beam", [["wood", 175]]],
    [    "slab", [["minerals", 250]]],
    [   "steel", [["iron", 100],["coal", 100]]],
    [   "plate", [["iron", 125]]],
    [   "alloy", [["titanium", 10],["steel", 75]]],
    ["kerosene", [["oil", 7500]]],
    [ "thorium", [["uranium", 250]]],
    [ "eludium", [["unobtainium", 1000],["alloy", 2500]]],
    ["scaffold", [["beam", 50]]],
    ["concrate", [["steel", 25],["slab", 2500]]], // sic concrate
    [    "gear", [["steel", 15]]],
    /* These must be last, anything after may be skipped by paperStarts..paperChoice */
    [ "parchment", [["furs",175]]],
    ["manuscript", [["parchment", 20],["culture",300]]],
    [ "compedium", [["manuscript", 50],["science",10000]]], // sic compedium
    [ "blueprint", [["compedium", 25],["science",25000]]]
];
var paperStarts = resources.findIndex(function(r){return r[0]=='parchment'});


/* These is the part of the code that lays out the GUI elements */
/* These is the part of the code that lays out the GUI elements */
/* These is the part of the code that lays out the GUI elements */
/* These is the part of the code that lays out the GUI elements */
/* These is the part of the code that lays out the GUI elements */


$("#footerLinks").append('<div id="SK_footerLink" class="column">'
    + ' | <a href="#" onclick="$(\'#SK_mainOptions\').toggle();"> ScriptKitties </a>'
    + '</div>');
$("#game").append(generateMenu());
$("#SK_mainOptions").hide(); // only way I can find to have display:grid but start hidden
$("#game").append(generateBuildingMenu());
switchTab('cath'); // default
$("#game").append(generateMinorOptionsMenu());

function generateMenu() {
    // Auto Assign drop-down
    var workerDropdown = '<select id="SK_assignChoice" style="{{grid}}" onclick="autoChoice=this.value;">';
    gamePage.village.jobs.forEach(job => { workerDropdown += `<option value="${job.name}">${job.title}</option>`; });
    workerDropdown += '</select>';

    // Auto Craft Paper drop-down
    var paperDropdown = '<select id="SK_paperChoice" style="{{grid}}" onchange="paperChoice=this.value;">';
    paperDropdown += '<option value="none" selected="selected">None</option>';
    paperDropdown += '<option value="parchment">Parchment</option>';
    paperDropdown += '<option value="manuscript">Manuscript</option>';
    paperDropdown += '<option value="compedium">Compendium</option>';
    paperDropdown += '<option value="blueprint">Blueprint</option>';
    paperDropdown += '</select>';

    // Auto Cycle drop-down
    var cycleDropdown = '<select id="SK_cycleChoice" style="{{grid}}" onchange="cycleChoice=parseInt(this.value);">';
    for (var i = 0; i < game.calendar.cycles.length; i++) {
        var cycle = game.calendar.cycles[i];
        var sel = (i==cycleChoice) ? ' selected="selected"' : '';
        var label = `${cycle.glyph} ${cycle.title}`;
        cycleDropdown += `<option value="${i}"${sel}>${label}</option>`;
    }
    cycleDropdown += '</select>';

    var grid = [ // Grid Layout
        [autoButton('Kill Switch', 'clearScript()')],
        [autoButton('Check Efficiency', 'kittenEfficiency()'), autoButton('Minor Options', '$(\'#SK_minorOptions\').toggle();')],
        [autoSwitchButton('Auto Build', 'build'), autoButton('Select Building', '$(\'#SK_buildingOptions\').toggle();')],
        [autoSwitchButton('Auto Assign', 'assign'), workerDropdown],
        [autoSwitchButton('Auto Craft', 'craft'), paperDropdown],
        ['<label style="{{grid}}">Secondary Craft %</label>',
            `<span style="display:flex; justify-content:space-around; {{grid}}" title="Between 0 and 100">`
            + `<label>min:</label><input type="text" style="width:25px" onchange="minSecResRatio=this.value" value="${minSecResRatio}">`
            + `<label>max:</label><input type="text" style="width:25px" onchange="maxSecResRatio=this.value" value="${maxSecResRatio}">`
            + `</span>`
        ],
        ['<span style="height:10px;{{grid}}"></span>'],
        [autoSwitchButton('Auto Hunt', 'hunt'), autoSwitchButton('Auto Praise', 'praise')],
        [autoSwitchButton('Auto Trade', 'trade'), autoSwitchButton('Auto Embassy', 'embassy')],
        [autoSwitchButton('Auto Party', 'party'), autoSwitchButton('Auto Explore', 'explore')],
        ['<span style="height:10px;{{grid}}"></span>'],
        [autoSwitchButton('Auto Cycle', 'cycle'), cycleDropdown],
        [autoSwitchButton('Shatterstorm', 'shatter'), autoSwitchButton('Auto BCoin', 'bcoin')],
        ['<span style="height:10px;{{grid}}"></span>'],
        [autoSwitchButton('Auto Science', 'research'), autoSwitchButton('Auto Upgrade', 'workshop')],
        [autoSwitchButton('Auto Religion', 'religion'), autoSwitchButton('Auto Unicorn', 'unicorn')],
        [autoSwitchButton('Energy Control', 'energy')],
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

function generateMinorOptionsMenu() {
    menu = '';
    menu += '<div id="SK_minorOptions" class="dialog help" style="border: 1px solid gray; display:none;">';
    menu += '<a href="#" onclick="$(\'#SK_minorOptions\').hide();" style="position: absolute; top: 10px; right: 15px;">close</a>';
    for (opt in minorOptions) {
        menu += `<input type="checkbox" id="SK_${opt}" onchange="minorOptions['${opt}'].enabled=this.checked""${minorOptions[opt].enabled?' checked':''}>`;
        menu += `<label style="padding-left:10px;" for="SK_${opt}">${minorOptions[opt].name}</label><br>`;
    }
    menu += '</div>';
    return menu;
}

function generateBuildingMenu() {
    menu = '';
    menu += '<div id="SK_buildingOptions" class="dialog help" style="border: 1px solid gray; display:none;">';
    menu +=   '<a href="#" onclick="$(\'#SK_buildingOptions\').hide();" style="position: absolute; top: 10px; right: 15px;">close</a>';
    menu +=   '<div class="tabsContainer">';
    menu +=     '<a href="#" id="SK_cathTab" class="tab" onclick="switchTab(\'cath\')" style="white-space: nowrap;">Cath</a>';
    menu +=     '<span> | </span>';
    menu +=     '<a href="#" id="SK_spaceTab" class="tab" onclick="switchTab(\'space\')" style="white-space: nowrap;">Space</a>';
    menu +=     '<span> | </span>';
    menu +=     '<a href="#" id="SK_timeTab" class="tab" onclick="switchTab(\'time\')" style="white-space: nowrap;">Time</a>';
    menu +=   '</div>';
    menu +=   '<div id="SK_BuildingFrame" class="tabInner">';
    menu +=     generateBuildingPane(cathGroups, 'cathBuildings');
    menu +=     generateBuildingPane(spaceGroups, 'spaceBuildings');
    menu +=     generateBuildingPane(timeGroups, 'timeBuildings');
    menu +=   '</div>';
    menu += '</div>';
    return menu;
}

function switchTab(name) {
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

function autoButton(label, script, id=null) {
    var cssClass = 'btn nosel modern';
    if (id) cssClass += ' disabled';
    var content = `<div class="btnContent" style="padding:unset"><span class="btnTitle">${label}</span></div>`;
    var button = `<div ${id?'id="'+id+'"':''} class="${cssClass}" style="width:auto; {{grid}}" onclick="${script}">${content}</div>`;
    return button;
}

function autoSwitchButton(label, key) {
    var element = 'SK_auto' + key[0].toUpperCase() + key.slice(1);
    var script = `autoSwitch('${key}', '${element}');`;
    return autoButton(label, script, element);
}

function generateBuildingPane(groups, elementsName) {
    var menu = '';
    menu += `<div id="SK_${elementsName}Pane" style="display:none; columns:2; column-gap:20px;">\n`;
    if (elementsName == 'spaceBuildings') {
        menu += '<input type="checkbox" id="SK_programs" onchange="programBuild=this.checked;">';
        menu += '<label for="SK_programs">Programs</label><br>\n';
    }
    var tab = elementsName.substring(0,4); // tab prefix
    menu += `<input type="checkbox" id="SK_${tab}TabChecker" onchange="selectChildren('SK_${tab}TabChecker','SK_${tab}Check');">`;
    menu += `<label for="SK_${tab}TabChecker">SELECT ALL</label><br>\n`;
    for (var i = 0; i < groups.length; i++)  {
        var label = groups[i][0];
        var lab = label.substring(0,3); // used for prefixes, "lab" is prefix of "label"
        menu += '<p style="break-inside: avoid;">'; // we want grouping to avoid widows/orphans
        menu += `<input type="checkbox" id="SK_${lab}Checker" class="SK_${tab}Check" onchange="selectChildren('SK_${lab}Checker','SK_${lab}Check');">`;
        menu += `<label for="SK_${lab}Checker"><b>${label}</b></label><br>\n`;

        for (var j = 0; j < groups[i][1].length; j++) {
            var bld = groups[i][1][j];
            var elements = window[elementsName];
            var bldLabel = elements[bld].name;
            menu += `<input type="checkbox" id="SK_${bld}" class="SK_${lab}Check" onchange="verifyElementSelected(${elementsName},\'${bld}\',this.checked)">`;
            menu += `<label style="padding-left:10px;" for="SK_${bld}">${bldLabel}</label><br>\n`;
        }
        menu += '</p>\n';
    }
    menu += '</div>\n';
    return menu;
}

function selectChildren(checker, checkee) {
    $('.'+checkee).prop('checked', document.getElementById(checker).checked).change();
}

function verifyElementSelected(elements, id, checked) {
    elements[id].enabled = checked;
}

function autoSwitch(id, element) {
    auto[id] = !auto[id];
    gamePage.msg(`${element} is now  ${(auto[id] ? 'on' : 'off')}`);
    $(`#${element}`).toggleClass('disabled', !auto[id]);
}

function clearScript() {
    $("#SK_footerLink").remove();
    $("#SK_mainOptions").remove();
    $("#SK_buildingOptions").remove();
    $("#SK_minorOptions").remove();
    clearInterval(runAllAutomation);
    auto = {}; // wipe fields
    bldSelectAddition = null;
    spaceSelectAddition = null;
    htmlMenuAddition = null;
    clearInterval();
    gamePage.msg('Script is dead');
}

// Show current kitten efficiency in the in-game log
function kittenEfficiency() {
    var secondsPlayed = game.calendar.trueYear() * game.calendar.seasonsPerYear * game.calendar.daysPerSeason * game.calendar.ticksPerDay / game.ticksPerSecond;
    var numberKittens = gamePage.resPool.get('kittens').value;
    var curEfficiency = (numberKittens - 70) / (secondsPlayed / 3600);
    gamePage.msg("Your current efficiency is " + parseFloat(curEfficiency).toFixed(2) + " Paragon per hour.");
}


/* These are the functions which are controlled by the runAllAutomation timer */
/* These are the functions which are controlled by the runAllAutomation timer */
/* These are the functions which are controlled by the runAllAutomation timer */
/* These are the functions which are controlled by the runAllAutomation timer */
/* These are the functions which are controlled by the runAllAutomation timer */


// Collection of Minor Auto Tasks
function autoMinor(ticksPerCycle) {
    if (minorOptions.feed.enabled) {
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
    if (minorOptions.observe.enabled) {
        var checkObserveBtn = document.getElementById("observeBtn");
        if (typeof(checkObserveBtn) != 'undefined' && checkObserveBtn != null) {
            document.getElementById('observeBtn').click();
        }
    }
    if (minorOptions.promote.enabled) {
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
function autoPraise(ticksPerCycle) {
    if (auto.praise && gamePage.bld.getBuildingExt('temple').meta.val > 0) {
        gamePage.religion.praise();
    }
}

// Build buildings automatically
function autoBuild(ticksPerCycle) {
    var built = false;
    if (auto.build && gamePage.ui.activeTabId == 'Bonfire') {
        var buttons = gamePage.tabs[0].buttons;

        for (i = 2; i < buttons.length; i++) {
            var name = buttons[i].model.metadata.name;
            if (buttons[i].model.enabled && cathBuildings[name].enabled) {
                buttons[i].controller.buyItem(buttons[i].model, {}, function(result) {
                    if (result) {built = true; buttons[i].update();}
                });
            }
        }
    }
    return built;
}

// Build space stuff automatically
function autoSpace(ticksPerCycle) {
    var built = false;
    if (auto.build && gamePage.spaceTab && gamePage.spaceTab.planetPanels) {
        // Build space buildings
        for (i = 0; i < gamePage.spaceTab.planetPanels.length; i++) {
            for (j = 0; j < gamePage.spaceTab.planetPanels[i].children.length; j++) {
                var spBuild = gamePage.spaceTab.planetPanels[i].children[j];
                if (spaceBuildings[spBuild.id].enabled && gamePage.space.getBuilding(spBuild.id).unlocked) {
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
        if (programBuild && gamePage.spaceTab && gamePage.spaceTab.GCPanel) {
            var spcProg = gamePage.spaceTab.GCPanel.children;
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
function autoTime(ticksPerCycle) {
    var built = false;
    if (auto.build) {
        var buttonGroups = [
            gamePage.religionTab?.zgUpgradeButtons,
            gamePage.religionTab?.ctPanel?.children[0]?.children,
            gamePage.timeTab?.cfPanel?.children[0]?.children,
            gamePage.timeTab?.vsPanel?.children[0]?.children
        ];

        for (buttons of buttonGroups) {
            if (buttons) {
                for (var i = 0; i < buttons.length; i++) {
                    var button = buttons[i];
                    if (timeBuildings[button.id]?.enabled && button.model.metadata.unlocked) {
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
function autoTrade(ticksPerCycle) {
    var traded = false;
    if (auto.trade) {
        var goldResource = gamePage.resPool.get('gold');
        var goldPerCycle = gamePage.getResourcePerTick('gold') * ticksPerCycle;
        var powerResource = gamePage.resPool.get('manpower');
        var powerPerCycle = gamePage.getResourcePerTick('manpower') * ticksPerCycle;
        var powerPerCycle = Math.min(powerPerCycle, powerResource.value); // don't try to spend more than we have
        var sellCount = Math.floor(Math.min(goldPerCycle/15, powerPerCycle/50));

        if (goldResource.value > (goldResource.maxValue - goldPerCycle)) { // don't check catpower
            var tiRes = gamePage.resPool.get('titanium');
            var unoRes = gamePage.resPool.get('unobtainium');

            if (unoRes.value > 5000 && gamePage.diplomacy.get('leviathans').unlocked && gamePage.diplomacy.get('leviathans').duration != 0) {
                gamePage.diplomacy.tradeAll(game.diplomacy.get("leviathans"));
                traded = true;
            } else if (tiRes.value < (tiRes.maxValue * 0.9) && gamePage.diplomacy.get('zebras').unlocked) {
                // don't waste the iron, make some space for it.
                var ironRes = gamePage.resPool.get('iron');
                var sellIron = game.diplomacy.get("zebras").sells[0];
                var expectedIron = sellIron.value * sellCount *
                    (1 + (sellIron.seasons ? sellIron.seasons[game.calendar.getCurSeason().name] : 0)) *
                    (1 + game.diplomacy.getTradeRatio() + game.diplomacy.calculateTradeBonusFromPolicies('zebras', game));
                if (ironRes.value > (ironRes.maxValue - expectedIron)) {
                    gamePage.craft('plate', (ironRes.value - (ironRes.maxValue - expectedIron))/125); // 125 is iron per plate
                }

                // don't overdo it
                var deltaTi = tiRes.maxValue - tiRes.value;
                var expectedTi = game.resPool.get("ship").value * 0.03;
                sellCount = Math.ceil(Math.min(sellCount, deltaTi / expectedTi));
                gamePage.diplomacy.tradeMultiple(game.diplomacy.get("zebras"), sellCount);
                traded = true;
            }
        }
    }
    return traded;
}

// Build Embassies automatically
function autoEmbassy(ticksPerCycle) {
    var built = false;
    if (auto.embassy && gamePage.diplomacyTab.racePanels && gamePage.diplomacyTab.racePanels[0]) {
        var culture = gamePage.resPool.get('culture');
        if (culture.value >= culture.maxValue * 0.99) { // can exceed due to MS usage
            var panels = gamePage.diplomacyTab.racePanels;
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
function autoExplore(ticksPerCycle) {
    var available = false;
    if (auto.explore && game.diplomacyTab.visible && game.resPool.get("manpower").value >= 1000) {
        for (race of game.diplomacy.races) {
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
            if (available) {
                console.log(`SK_Debug: Going to explore, hoping for a ${race.name}`);
                break;
            }
        }
        if (available) {
            var button = game.diplomacyTab.exploreBtn;
            button.controller.buyItem(button.model, {}, function(result) {
                if (result) {built = true; button.update();}
            });
        } else {
            console.log("SK_Debug: no explore options");
        }
    }
    return available;
}

// Hunt automatically
function autoHunt(ticksPerCycle) {
    if (auto.hunt) {
        var catpower = gamePage.resPool.get('manpower');
        if (catpower.value > (catpower.maxValue - 1)) {
            gamePage.village.huntAll();
        }
    }
    return false; // we huntAll(), shouldn't need to run again
}

// Craft primary resources automatically
function autoCraft(ticksPerCycle) {
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
    if (auto.craft) {
        // Craft primary resources
        for (var i = 0; i < resources.length; i++) {
            var output = resources[i][0];
            var inputs = resources[i][1];
            var outRes = gamePage.resPool.get(output);
            if (output == 'parchment' && paperChoice == 'none') break; // user asked for no papers
            if (! outRes.unlocked) continue;

            var craftCount = Infinity;
            var minimumReserve = Infinity;
            for (var j = 0; j < inputs.length; j++) {
                var inRes = gamePage.resPool.get(inputs[j][0]);
                craftCount = Math.min(craftCount, Math.floor(inRes.value / inputs[j][1])); // never try to use more than we have

                if (inRes.maxValue != 0) {
                    // primary resource
                    var resourcePerCycle = gamePage.getResourcePerTick(inputs[j][0], 0) * ticksPerCycle;
                    if (resourcePerCycle < inRes.maxValue && inRes.value < (inRes.maxValue - resourcePerCycle)) {
                        craftCount = 0;
                    } else {
                        craftCount = Math.min(craftCount, resourcePerCycle / inputs[j][1]);
                    }
                } else if (i < paperStarts) {
                    // secondary resource
                    var resMath = inRes.value / inputs[j][1];
                    if (resMath <= 1 || outRes.value > (inRes.value * (maxSecResRatio / 100))) craftCount = 0;
                    craftCount = Math.min(craftCount, resMath * (maxSecResRatio / 100));
                } else {
                    // secondary resource: fur, parchment, manuscript, compendium
                    craftCount = Math.min(craftCount, (inRes.value / inputs[j][1]));
                }
                // for when our capacity gets large compared to production
                minimumReserve = Math.min(minimumReserve, (inRes.value / inputs[j][1]) * (minSecResRatio / 100) - outRes.value);
            }
            craftCount = Math.max(craftCount, minimumReserve);
            if (craftCount == 0 || craftCount == Infinity) {
                // nothing to do
            } else if (paperChoice == 'blueprint' && output == 'compedium' && gamePage.resPool.get('compedium').value > 25) {
                // save science for making blueprints
            } else {
                gamePage.craft(output, craftCount);
            }
            if (output == paperChoice) break; // i.e. if we're processing the user's choice, then we're done
        }
    }
    return false; // we scale action to need, re-run never required
}

// Auto Research
function autoResearch(ticksPerCycle) {
    var acted = false;
    if (auto.research && gamePage.libraryTab.visible) {
        var science = gamePage.resPool.get('science').value;
        var bestButton = null;
        var bestCost = Infinity;
        techloop: for (button of gamePage.libraryTab.buttons) {
            var cost = 0;
            for (price of button.model.prices) {
                if (price.name == 'science') cost = price.val;
                if (minorOptions.conserveRare.enabled && rareResources.includes(prices.name)) {
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

// Auto Workshop upgrade, tab 3
function autoWorkshop(ticksPerCycle) {
    var acted = false;
    if (auto.workshop && gamePage.workshopTab.visible) {
        var science = gamePage.resPool.get('science').value;
        var bestButton = null;
        var bestCost = Infinity;
        for (button of gamePage.workshopTab.buttons) {
            var cost = 0;
            for (price of button.model.prices) if (price.name == 'science') cost = price.val
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
function autoReligion(ticksPerCycle) {
    var bought = false;
    if (auto.religion && gamePage.religionTab.visible) {
        var buttons = gamePage.religionTab.rUpgradeButtons;
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
        var faith = gamePage.resPool.get('faith');
        if (minorOptions.religion2praise.enabled && bought == false && faith.value >= faith.maxValue) {
            autoSwitch('praise', 'SK_autoPraise');
            auto.praise = true;
        }
    }
    return bought;
}

// Auto buy unicorn upgrades
function autoUnicorn(ticksPerCycle) {
    var acted = false;
    if (auto.unicorn && gamePage.religionTab.visible) {
        /* About Unicorn Rifts
         * Each Tower causes a 0.05% chance for a rift per game-day
         * Each rift produces 500 Unicorns * (Unicorn Production Bonus)/10
         */
        var riftUnicorns = 500 * (1 + game.getEffect("unicornsRatioReligion") * 0.1);
        var unicornChanceRatio = 1.1 * (1 + game.getEffect("timeRatio") * 0.25);
        var upsprc = riftUnicorns * unicornChanceRatio / 2; // unicorns per second per riftChance
        var ups = 5 * gamePage.getResourcePerTick('unicorns') / (1 + game.getEffect("unicornsRatioReligion"));
        // Constants for Ivory Meteors
        var meteorChance = game.getEffect("ivoryMeteorChance") * unicornChanceRatio / 2;
        var ivoryPerMeteor = 250 + 749.5 * (1 + game.getEffect("ivoryMeteorRatio"));

        // find which is the best value
        var buttons = gamePage.religionTab.zgUpgradeButtons;
        var bestButton = null;
        var bestValue = 0.0;
        for (var i = 0; i < buttons.length; i++) {
            if (buttons[i].model.metadata.unlocked) {
                if (! minorOptions.unicornIvory.enabled) {
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
            for (price of bestButton.model.prices) {
                if (price.name == 'tears') {
                    var tearCost = price.val;
                } else if (price.val > gamePage.resPool.get(price.name).value) {
                    otherCosts = false;
                }
            }
            if (otherCosts) {
                var unicorns = gamePage.resPool.get('unicorns').value;
                var tears = gamePage.resPool.get('tears').value;
                var zigs = game.bld.get("ziggurat").on;
                var available = tears + Math.floor(unicorns / 2500) * zigs;
                if (available > tearCost) {
                    if (tears < tearCost) {
                        var sacButton = gamePage.religionTab.sacrificeBtn;
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
function autoParty(ticksPerCycle) {
    if (auto.party && gamePage.science.get("drama").researched) {
        var catpower = gamePage.resPool.get('manpower').value;
        var culture = gamePage.resPool.get('culture').value;
        var parchment = gamePage.resPool.get('parchment').value;

        if (catpower > 1500 && culture > 5000 && parchment > 2500) {
            if (gamePage.prestige.getPerk("carnivals").researched && gamePage.calendar.festivalDays < 400*10) {
                gamePage.village.holdFestival(1);
            } else if (gamePage.calendar.festivalDays == 0) {
                gamePage.village.holdFestival(1);
            }
        }
    }
    return false; // there is never a need to re-run
}

// Auto assign new kittens to selected job
function autoAssign(ticksPerCycle) {
    if (auto.assign && gamePage.village.getJob(autoChoice).unlocked && gamePage.village.hasFreeKittens()) {
        gamePage.village.assignJob(gamePage.village.getJob(autoChoice), 1);
        return true;
    } else {
        return false;
    }
}

function autoDoShatter(years) {
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
    autoCraft(shatterTCGain * ticksPassing);

    // do shatter
    var btn = gamePage.timeTab.cfPanel.children[0].children[0]; // no idea why there's two layers in the code
    btn.controller.doShatterAmt(btn.model, years);
    return timeslip;
}

// Keep Shattering as long as Space-Time is cool enough
function autoShatter(ticksPerCycle, shattering) {
    var timeslip = false;
    if (auto.shatter || auto.cycle) {
        if (gamePage.timeTab.cfPanel.visible && game.calendar.day >= 0) { // avoid shattering DURING paradox
            var startOfSeason = game.calendar.day * game.calendar.ticksPerDay < 3 * ticksPerCycle;
            var lowHeat = game.time.heat < Math.max(5, ticksPerCycle * game.getEffect("heatPerTick"));
            var startStorm = shattering || (minorOptions.wait4void.enabled ? startOfSeason : true) && lowHeat;

            // find length of shatter storm
            var shatter = 0;
            if (auto.shatter && startStorm) {
                // how many shatters worth of heat can we afford?
                var factor = game.challenges.getChallenge("1000Years").researched ? 5 : 10;
                var shatter = Math.ceil((game.getEffect('heatMax') - game.time.heat) / factor);
            }

            // adjust to end in the right cycle
            if (auto.cycle && game.calendar.cycle != cycleChoice) {
                // desired cycle: cycleChoice
                // current cycle: game.calendar.cycle
                // year in cycle: game.calendar.cycleYear
                var deltaCycle = (cycleChoice - game.calendar.cycle + game.calendar.cycles.length) % game.calendar.cycles.length;
                var yearsToCycle = deltaCycle*5 - game.calendar.cycleYear;
                shatter = Math.floor(shatter / 50)*50 + yearsToCycle;
            }

            // click the button
            if (shatter != 0 && shatter < gamePage.resPool.get('timeCrystal').value) {
                timeslip = autoDoShatter(shatter);
            }
        }
    }
    return timeslip;
}

// Control Energy Consumption
function energyControl(ticksPerCycle) {
    if (auto.energy) {
        proVar = gamePage.resPool.energyProd;
        conVar = gamePage.resPool.energyCons;

        if (bldAccelerator.val > bldAccelerator.on && proVar > (conVar + 3)) {
            bldAccelerator.on++;
            conVar++;
        } else if (bldCalciner.val > bldCalciner.on && proVar > (conVar + 3)) {
            bldCalciner.on++;
            conVar++;
        } else if (bldFactory.val > bldFactory.on && proVar > (conVar + 3)) {
            bldFactory.on++;
            conVar++;
        } else if (bldOilWell.val > bldOilWell.on && proVar > (conVar + 3)) {
            bldOilWell.on++;
            conVar++;
        } else if (bldBioLab.val > bldBioLab.on && proVar > (conVar + 3)) {
            bldBioLab.on++;
            conVar++;
        } else if (bldBioLab.on > 0 && proVar < conVar) {
            bldBioLab.on--;
            conVar--;
        } else if (bldOilWell.on > 0 && proVar < conVar) {
            bldOilWell.on--;
            conVar--;
        } else if (bldFactory.on > 0 && proVar < conVar) {
            bldFactory.on--;
            conVar--;
        } else if (bldCalciner.on > 0 && proVar < conVar) {
            bldCalciner.on--;
            conVar--;
        } else if (bldAccelerator.on > 0 && proVar < conVar) {
            bldAccelerator.on--;
            conVar--;
        }
    }
    return false;
}

// Auto buys and sells bcoins optimally (not yet tested)
function autoBCoin(ticksPerCycle) {
    if (auto.bcoin && gamePage.science.get("antimatter").researched) {
        // When the price is > 1100 it loses 20-30% of its value
        // 880+ε is the highest it could be after an implosion
        //
        // Prior was buy < 881; sell > 1099
        // However, we want to keep stuffing BC in until the last minute
        // Well, the last hour or two.
        if (gamePage.calendar.cryptoPrice < 1095) {
            gamePage.diplomacy.buyBcoin();
        } else if (gamePage.resPool.get('blackcoin').value > 0) {
            gamePage.diplomacy.sellBcoin();
        }
    }
    return false;
}

function autoNip(ticksPerCycle) {
    if (auto.build && gamePage.bld.buildingsData[0].val < 20) {
        $(".btnContent:contains('Gather')").trigger("click");
    }
    return false;
}

/** This governs how frequently tasks are run
 *   fn: what function to run
 *   interval: how often to run, in ticks, that's 0.2 seconds
 *   offset: small value to stagger runs, MUST be less than interval
 *   override: force run next tick, dynamic, used to take sequences of actions
 **/
var autoSchedule = [
    // every tick
    {fn:autoBuild,    interval:1,  offset:0,   override:false},
    {fn:autoNip,      interval:1,  offset:0,   override:false},
    {fn:autoPraise,   interval:1,  offset:0,   override:false},

    // every 0.6 seconds
    {fn:autoCraft,    interval:3,  offset:0,   override:false},
    {fn:autoMinor,    interval:3,  offset:1,   override:false},
    {fn:autoHunt,     interval:3,  offset:2,   override:false},

    // every 2 seconds == every game-day
    {fn:energyControl,interval:10, offset:2,   override:false},
    {fn:autoSpace,    interval:10, offset:4,   override:false},
    {fn:autoParty,    interval:10, offset:6,   override:false},
    {fn:autoTime,     interval:10, offset:8,   override:false},

    // every 4 seconds; schedule on odd numbers to avoid the interval:10
    {fn:autoAssign,   interval:20, offset:3,   override:false},
    {fn:autoResearch, interval:20, offset:7,   override:false},
    {fn:autoWorkshop, interval:20, offset:9,   override:false},
    {fn:autoReligion, interval:20, offset:13,  override:false},
    {fn:autoTrade,    interval:20, offset:15,  override:false},
    {fn:autoShatter,  interval:20, offset:17,  override:false},
    {fn:autoEmbassy,  interval:20, offset:19,  override:false},

    // every minute, schedule == 10%20 to avoid both above
    {fn:autoExplore,  interval:300, offset:70,  override:false},
    {fn:autoUnicorn,  interval:300, offset:130, override:false},
    {fn:autoBCoin,    interval:300, offset:230, override:false},
]

// This function keeps track of the game's ticks and uses math to execute these functions at set times relative to the game.
// Offsets are staggered to spread out the load. (Not that there is much).
clearInterval(runAllAutomation);
var runAllAutomation = setInterval(function() {
    var ticks = gamePage.timer.ticksTotal;
    for (task of autoSchedule) {
        if (task.override || ticks % task.interval == task.offset) {
            task.override = task.fn(task.interval, task.override);
        }
    }
}, 200);
