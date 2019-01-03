(function() {
  var debugOn = false;
  var manifest = chrome.runtime.getManifest();
  var siteOptions = manifest.content_scripts[0].matches.map(function(pattern) {
    return pattern.match(/[^\*\.\:\/]+\.[^\s\/]{2,}/)[0]
  });

  var minAge = 51; // p25 of article ages
  var maxAge = 351; // p75 of article ages
  var superAge = 1830; // p99 of article ages
  // contact me if you're interested in the data i used to get these numbers - 
  // there's about 140MB of it.

  chrome.storage.sync.get({
    debug: false,
    enabledSites: siteOptions
  }, function(items) {
    if (items.debug === true) {
      debugOn = true;
    }

    for (site of items.enabledSites) {
      if (document.location.hostname.match(site)) {
        getArticleAge(function(age) {
          insertOverlay();
          var level = getAgeLevel(age);
          agePage(level);

          if (document.location.hostname.match('en.wikipedia') && age >= superAge) {
            debug('Article age is over ' + superAge + ' days, adding aged logo.');
            var logo = document.getElementsByClassName('mw-wiki-logo')[0];
            var logoUrl = chrome.extension.getURL('images/wiki-logo.png');
            logo.style.backgroundImage = 'url(\'' + logoUrl + '\')';
          }
        });
      }
    }
  });

  function getArticleAge(cb) {
    var mainPages = ['main page', 'заглавная'];
    if (!document.body.classList.contains('skin-vector')) {
      // we're not using the vector skin
      //TODO: add support for other skins
      return null
    } else if (document.getElementById('ca-nstab-main') === null) {
      // we're not in the article namespace
      return null
    } else if (document.querySelector('#ca-nstab-main>span>a') && document.querySelector('#mw-panel>div.portal>div.body>ul>li:first-child>a') && document.querySelector('#ca-nstab-main>span>a').text.toLowerCase() === document.querySelector('#mw-panel>div.portal>div.body>ul>li:first-child>a').text.toLowerCase()) {
      // making sure we're definitely not on the main page
      return null
    } else if (document.querySelector('#ca-nstab-main>span>a') && mainPages.indexOf(document.querySelector('#ca-nstab-main>span>a').text.toLowerCase()) !== -1) {
      // making sure we're definitely not on the main page
      return null
    } else if (document.getElementById('noarticletext') !== null) {
      // the article doesn't exist (red link)
      return null
    } else if (!document.getElementById('ca-view').classList.contains('selected')) {
      // we're not on an article's reading page
      return null
    }

    //var path = document.location.pathname;
    var path = document.querySelector('link[rel=canonical]').href;

    var titleMatch = path.match(/\/wiki\/(.*)/);
    if (typeof titleMatch !== 'object' || titleMatch.length < 2) {
      // did not match article title
      return null
    }

    var title = titleMatch[1];
    debug('Page title: ' + title);

    var userAgent = manifest.name + '/' + manifest.version;
    userAgent += ' (https://github.com/okofish/wikiage)';

    var request = new XMLHttpRequest();
    request.responseType = 'json';
    request.open('GET', '/api/rest_v1/page/title/' + title, true);
    request.setRequestHeader('Api-User-Agent', userAgent);

    request.onload = function() {
      if (request.status >= 200 && request.status < 400) {
        var data = request.response;
        handleData(data);
      }
    };

    function handleData(data) {
      if (data.hasOwnProperty('items') && data.items.length > 0) {
        var timestamp = data.items[0].timestamp;
        var date = new Date(timestamp);
        var age = (new Date()) - date;
        var ageInDays = age / 1000 / 60 / 60 / 24;
        debug('Article age: ' + Math.round(ageInDays) + ' days');
        if (ageInDays > 0) {
          cb(ageInDays);
        }
      }
    }

    request.send();
  }

  function getAgeLevel(age) {
    var ageLevel = (age - minAge) / (maxAge - minAge);
    if (ageLevel < 0) {
      ageLevel = 0;
    } else if (ageLevel > 1) {
      ageLevel = 1;
    }

    debug('Age level: ' + ageLevel);
    return ageLevel
  }

  function agePage(level) {
    if (level < 0) {
      level = 0;
    } else if (level > 1) {
      level = 1;
    }

    var desaturation = 1 - (.5 * level);
    var saturation = 1 + (1.5 * level);

    var overlayElem = document.getElementById('wikiage-overlay');
    overlayElem.style.filter = 'saturate(' + saturation + ')';

    document.querySelectorAll('body > div:not(.wikiage):not(#mw-navigation)').forEach(function(elem) {
      elem.style.cssText = 'filter: saturate(' + desaturation + ') sepia(' + (1 - desaturation) + ') !important;'
    });

    fadeElem(overlayElem, level, 400);
    fadeElem(document.getElementById('wikiage-cracks'), level, 400);
  }

  function insertOverlay() {
    var overlay = document.createElement('div');
    var overlayUrl = chrome.extension.getURL('images/overlay.jpg');
    overlay.id = 'wikiage-overlay';
    overlay.style.backgroundImage = 'url(' + overlayUrl + ')';
    overlay.style.height = document.documentElement.scrollHeight + 'px';
    overlay.style.opacity = 0;
    overlay.classList.add('wikiage');
    document.body.insertBefore(overlay, document.body.firstChild);

    var cracks = document.createElement('div');
    var cracksUrl = chrome.extension.getURL('images/cracks.png');
    cracks.id = 'wikiage-cracks';
    cracks.style.backgroundImage = 'url(' + cracksUrl + ')';
    cracks.style.height = document.documentElement.scrollHeight + 'px';
    cracks.style.opacity = 0;
    cracks.classList.add('wikiage');
    document.body.insertBefore(cracks, document.body.firstChild);

    function correctOverlaySize() {
      overlay.style.height = document.documentElement.scrollHeight + 'px';
      cracks.style.height = document.documentElement.scrollHeight + 'px';
    }

    window.addEventListener('resize', correctOverlaySize);

    // in case there's any dynamically-generated content that changes the page size after load
    //TODO: find a better way to do this
    setTimeout(correctOverlaySize, 500);
    setTimeout(correctOverlaySize, 1000);
    setTimeout(correctOverlaySize, 1500);
    setTimeout(correctOverlaySize, 2000);
  }

  function fadeElem(e, target, duration) {
    var interval = 20;
    var totalFrames = Math.ceil(duration / interval);
    var frame = 1;
    var initialOpacity = parseFloat(e.style.opacity);

    nextFrame();

    function nextFrame() {
      var fraction = frame / totalFrames;
      var currentOpacity = initialOpacity + (target - initialOpacity) * fraction;
      e.style.opacity = currentOpacity;
      if (frame < totalFrames) {
        setTimeout(nextFrame, interval);
      }
      frame++;
    }
  }

  function debug(msg) {
    if (debugOn === true) {
      console.log(msg);
    }
  }
})();
