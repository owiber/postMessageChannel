(function (exports) {

  var callbackMethod = '__postMessageChannel_callback';
  var readyMethod = '__postMessageChannel_ready';
  var utils = {};

  // @license MIT - promiscuous library - ©2013 Ruben Verborgh - https://github.com/RubenVerborgh/promiscuous/
  (function(){function e(){var c,u,f={then:function(e,n){return c(e,n)}};return function(){var i=[];c=function(n,r){var t=e();return i.push({d:t,resolve:n,reject:r}),t.promise},u=function(e,v,s){for(var a=0,p=i.length;p>a;a++){var h=i[a],l=h.d,d=h[e];typeof d!==t?l[e](v):r(d,v,l)}c=n(f,v,s),u=o}}(),{resolve:function(e){u("resolve",e,!0)},reject:function(e){u("reject",e,!1)},promise:f}}function n(n,o,c){return function(u,f){var i,v=c?u:f;return typeof v!==t?n:(setTimeout(r.bind(n,v,o,i=e())),i.promise)}}function r(e,n,r){try{var o=e(n);o&&typeof o.then===t?o.then(r.resolve,r.reject):r.resolve(o)}catch(c){r.reject(c)}}var t="function",o=function(){};utils.promiscuous={resolve:function(e){var r={};return r.then=n(r,e,!0),r},reject:function(e){var r={};return r.then=n(r,e,!1),r},deferred:e}})();

  function Deferred () {
    return utils.promiscuous.deferred();
  }

  var postMessageChannel = function (opts) {
    if ( !(this instanceof postMessageChannel) ) {
      return new postMessageChannel(opts);
    }
    var options = opts || {};
    var dfds = [];
    var methods = options.methods || {};
    var readyDfd = Deferred();

    if ( !(options.scope && options.origin && options.window) ) {
      throw new Error('scope, origin, and window options are required');
    }

    var scope = options.scope;
    var origin = options.origin;
    var targetWindow = options.window;
    var internalMethods = {};
    internalMethods[readyMethod] = function (message) {
      readyDfd.resolve(message.data);
    };
    internalMethods[callbackMethod] = function (message) {
      if (message && dfds[message.dfdId]) {
        dfds[message.dfdId][message.state || 'resolve'](message.data);
        delete dfds[message.dfdId];
      }
    };

    function sendMessage (method, data, dfdId) {
      targetWindow.postMessage({
        scope: scope,
        dfdId: dfdId,
        data: data,
        method: method
      }, origin);
    }

    window.addEventListener('message', function (event) {
      var message = event.data || {};
      if (message.method && message.scope === scope && internalMethods[message.method]) {
        internalMethods[message.method](message);
      }
      else if (message.dfdId !== undefined && message.method && message.scope === scope && methods[message.method]) {
        var isAsync = false;
        var done = function (data) {
          sendMessage(callbackMethod, data, message.dfdId);
        };
        var context = {
          async: function () {
            isAsync = true;
            return done;
          }
        };

        var result = methods[message.method].call(context, message.data);
        if (!isAsync) {
          done(result);
        }
      }
    });

    this.promise = readyDfd.promise;

    this.ready = function (fn) {
      this.promise.then(fn);
    }

    this.addMethod = function (method, fn) {
      methods[method] = fn;
    };

    this.removeMethod = function (method) {
      delete methods[method];
    };

    this.run = function (method, data) {
      var dfdId = dfds.length;
      var dfd = Deferred();
      dfds.push(dfd);
      sendMessage(method, data, dfdId);
      return dfd.promise;
    };

    sendMessage(readyMethod);
  };

  if (typeof define === 'function' && define.amd) {
    define([], function () { return postMessageChannel; });
  } else {
    exports.postMessageChannel = postMessageChannel;
  }
}(this));