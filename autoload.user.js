// ==UserScript==
// @name         Autoload ScriptKitties
// @namespace    http://sagefault.net/
// @version      1.0
// @description  See name
// @match        http*://bloodrizer.ru/games/kittens/
// @match        http*://kittensgame.com/web/
// @match        http*://kittensgame.com/beta/
// @match        http*://kittensgame.com/alpha/
// @grant        none
// ==/UserScript==
window.addEventListener("load", function() {
    var script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/gh/JonathanBeverley/KittensGame/ScriptKitties.js';
    script.id='SK_origin';
    document.body.appendChild(script);
}, false);
