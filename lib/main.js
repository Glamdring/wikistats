var {data}                  = require("sdk/self");
var {Cc, Ci}                = require("chrome");
var tabs 					= require("sdk/tabs");

var data 					= require("sdk/self").data;
var widgets 				= require("sdk/widget");
var tabs 					= require("sdk/tabs");

var widget = widgets.Widget({
  id: "wikistats-link",
  label: "Wikipedia Usage Statistics",
  contentURL: data.url("icon.png"),
  onClick: function() {
    tabs.open({
		url: data.url("page.html"),
		onReady: function(tab) {
			jsonObject = JSON.stringify(getStats())
			tab.attach({
				contentScript: "document.getElementById('stats').value = '" + jsonObject + "'; document.getElementById('initButton').click();"
			});
		}
	});
  }
});

function getStats() {
	var historyService = Cc["@mozilla.org/browser/nav-history-service;1"]
                               .getService(Ci.nsINavHistoryService);

	// No query options set will get all history, sorted in database order,
	// which is nsINavHistoryQueryOptions.SORT_BY_NONE.
	var options = historyService.getNewQueryOptions();
	options.resultType = Ci.nsINavHistoryQueryOptions.RESULTS_AS_VISIT;

	var days = 90;
	var query = historyService.getNewQuery();
	query.beginTimeReference = query.TIME_RELATIVE_NOW;
	query.beginTime = -days * 24 * 60 * 60 * 1000000;
	query.endTime = 0;
	query.domain = "wikipedia.org";
	
	// execute the query
	var result = historyService.executeQuery(query, options);
	var stats = {};
	
	var cont = result.root;
    cont.containerOpen = true;
	
	var byDayOfWeek = new Array();
	initializeArray(byDayOfWeek, 7);
	var byHourOfDay = new Array();
	initializeArray(byHourOfDay, 24);
	var totalPages = cont.childCount;
	var uniquePages = 0;
	var uris = {};
	var articleSectionNodes = []
	for (var i = 0; i < cont.childCount; i ++) {
		var node = cont.getChild(i);
		var uri = node.uri;
		// URLs containing # should not be counted as separate articles
		if (uri.indexOf("#") > -1) {
			// unless there is no corresponding base article (i.e. reached the # through google's "Jump to")
			articleSectionNodes.push(node);
			totalPages--;
			continue;
		}
		var time = new Date(node.time / 1000);
		byDayOfWeek[time.getDay()]++;
		byHourOfDay[time.getHours()]++;
		
		if (uris[uri] == undefined) {
			uris[uri] = 1;
			uniquePages ++;
		}
		uris[uri] ++;
	}
	
	// also count URLs with # that do not have a corresponding main article entry (i.e. they were only opened through "Jump to")
	for (var i = 0; i < articleSectionNodes.length; i++) {
		var uri = articleSectionNodes[i].uri;
		if (uris[uri.substring(0, uri.indexOf("#"))] == undefined) {
			totalPages ++;
			uniquePages ++;
			uris[uri] = 1;
			var time = new Date(articleSectionNodes[i].time / 1000);
			byDayOfWeek[time.getDay()]++;
			byHourOfDay[time.getHours()]++;
		}
	}
	
	cont.containerOpen = false;
	
	
	stats.totalPages = totalPages;
	stats.uniquePages = uniquePages;
	stats.averagePerDay = Math.round(totalPages / days * 100) / 100;
	stats.byDayOfWeek = byDayOfWeek;
	stats.byHourOfDay = byHourOfDay;
	stats.mostVisited = getTop(uris, 10);
	return stats;
}

function initializeArray(array, size) {
	for (var i = 0; i < size; i++) {
		array[i] = 0;
	}
}

function getTop(holder, count) {
	var tuples = [];

	for (var key in holder) {
		tuples.push([key, holder[key]]);
	}

	tuples.sort(function(a, b) {
		a = a[1];
		b = b[1];

		return a < b ? 1 : (a > b ? -1 : 0);
	});
	
	return tuples.slice(0, 5);
}