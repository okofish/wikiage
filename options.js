var siteOptions = chrome.runtime.getManifest().content_scripts[0].matches.map(function(pattern){return pattern.match(/[^\*\.\:\/]+\.[^\s\/]{2,}/)[0]});

function save_options() {
  var debug = document.getElementById('debug').checked;
  var enabledSites = [];
  for (site of siteOptions) {
    var siteElement = document.getElementById(site);
    if (siteElement.checked === true) {
      enabledSites.push(site);
    }
  }
  chrome.storage.sync.set({
    debug: debug,
    enabledSites: enabledSites
  }, function() {
    var status = document.getElementById('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 750);
  });
}

function restore_options() {
  var sitesContainer = document.getElementById('sites-container');
  for (site of siteOptions) {
    var siteElement = document.createElement('label');
    siteElement.textContent = site;
    
    var siteCheckbox = document.createElement('input');
    siteCheckbox.type = 'checkbox';
    siteCheckbox.id = site;
    
    siteElement.insertBefore(siteCheckbox, siteElement.firstChild);
    sitesContainer.appendChild(siteElement);
    sitesContainer.appendChild(document.createElement('br'));
  }
  
  chrome.storage.sync.get({
    debug: false,
    enabledSites: siteOptions
  }, function(items) {
    document.getElementById('debug').checked = items.debug;
    for (site of items.enabledSites) {
      var siteElement = document.getElementById(site);
      siteElement.checked = true;
    }
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
