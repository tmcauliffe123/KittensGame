# ScriptKitties
A script to automate playing the addicting [Kittens Game](https://kittensgame.com/web/).

Note: This was a fork from the script MaPaul1977 originally made with some modifications by araemo, and others by Tsolron.
Note: This is a _total_ overhaul of the above.

## How do I use the script?

If you want to use this, you need to load it into the browser. The easiest way is to create a bookmarklet like the following, and run it after loading the game. However, Github doesn't like people using it as a hosting solution, so they've deliberately broken the ability to use it for that. However, [jsDelivr](https://www.jsdelivr.com/), offers a free CDN solution for GitHub repos, so you can use the follow.

    javascript:(function(){var d=document,s=d.createElement('script');s.src='https://cdn.jsdelivr.net/gh/JonathanBeverley/KittensGame/ScriptKitties.js';d.body.appendChild(s);})();

Alternatively, you can paste the contents of the script into the developer console.
I'm sure there's a better way to do it, probably using GreaseMonkey or similar.

Once loaded, the button to get to the ScriptKitties option menu is in the bottom right "footer" links.

## What does it do?

Currently this script will automatically do the following:

1) Build
2) Craft
3) Assign
5) Hunt
6) Trade
7) Praise
8) Festival

9) Build Embassies
10) Maintain Cycle
11) Research Science
12) Workshop Upgrades
13) Order of the Sun
14) Unicorn Structures
15) Energy Control
16) BlackCoin Trading


## What are some interesting details?

**BUILD:** ScriptKitties will automatically build any of the buildings on the Bonfire tab, and it lets you choose exactly which ones you want! If you want to turn on or off an entire group of buildings, just click the header. For space buildings, click the small "space" link in the upper corner.

**ASSIGN:** Lazy kittens not doing anything? Give a specified role to all those "free" kittens!

**CRAFT:** ScriptKitties keeps your resources from capping out! You can be sure to keep a healthy supply of crafted resources coming!

**HUNT:** Don't let your catpower go to waste! Automatically send your kittens on hunting expeditions to get your furs, ivory, and unicorns!

**TRADE:** Automagically trade with Zebras, Dragons, and the Elders! Keep your titanium stores full and never miss a visit from the Elders!

**PRAISE:** Want a praise bonus that will make a difference? Turn on Auto Praise and see your faith based productivity skyrocket by praising the sun every tick!

**FESTIVAL:** If you have the resources, ScriptKitties will keep the party going!

**EMBASSIES:** Do you like trading? Embassies help trading. How about automatically building the cheapest one every time culture maxes out?

**CYCLES:** Master time itself! Always enjoy the benefits of your favourite cycle!

**RESEARCH:** Don't let your kitten kingdom stagnate! As soon as you have the requirements, ScriptKitties will make sure to research new technologies for you.

**UPGRADE:** Want to upgrade your buildings and abilities, but don't want to just sit there waiting? Let the script make upgrades whenever you are able!

**RELIGION:** Want all those amazing temple upgrades? Want no more!

**UNICORNS:** Never sure which one is most cost-effective? Stop wondering and let ScriptKitties build those wonders for you!

**ENERGY:** Don't worry about having negative energy or wasted potential! Turn on Energy Control, and you will stay between 0 and 3 Watts of surplus power!

You can use this script as much or as little as you like, but if you turn on all the options, it will basically run the Kittens Game from reset to reset.

Enjoy!

## Tsolron's notable modifications:
* Can autocraft resources without also auto-crafting furs to Parchment (or others in that line)
* If Blueprints are selected, will only craft Compendiums if there are not enough to make Blueprints
* Will auto-build buildings even if you haven't unlocked some of them
* Fixed building selection pop-up so all buildings appear on-screen

## Jonathan's notable modifications:
* Building list is dynamically populated from game data
* Crafting from Science and Culture tries to maintain a large stockpile for the user
* Better handling of crafting that takes multiple inputs (steel, alloy, ...)
* Eliminate tab-switching to improve usability while script is running
* AutoEmbassy(), AutoExplore(), AutoCycle(), AutoShatter(), AutoReligion(), AutoUnicorn(), ...
* Numerous bugfixes, most of which are for bugs he introduced.

## Important Considerations
* Some scripts can starve other scripts of resources. Most obvious is that "Auto Religion" will never do anything if "Auto Praise" is on. More subtly, since "Auto Craft" only uses capped resources, it won't generate Steel or Alloy until "Auto Build" is done with them. 
* "Auto Cycle" won't stop just because the fabric of spacetime is melting due to chronoheat. Build some Furnaces.
* Try to keep Coal generation less than Iron generation so that Plates get crafted.
* Early game, the script will make poor choices, because it does what is cheapest.
* The script won't craft any resource that you haven't "unlocked", which roughly means "is visible on the left panel". You need to craft one of each manually to prime the pump.

## Any special thanks?

A huge thanks to the authors of both AutoKittens and KittenScientists for some of the ideas I integrated into this script!

Thanks also go out to each of these reddit users for their help!

- Patashu
- Saucistophe
- Trezzie
- DamianDavis
- curiouscorncob
- hughperman
- dbsps
- kbob
