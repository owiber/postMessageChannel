(function (exports) {

  var callbackMethod = '__postMessageChannel_callback';
  var readyMethod = '__postMessageChannel_ready';
  var utils = {};

  (function (window) {
    // @license MIT - promiscuous library - ©2013 Ruben Verborgh - https://github.com/RubenVerborgh/promiscuous/
    (function(){function e(){var c,u,f={then:function(e,n){return c(e,n)}};return function(){var i=[];c=function(n,r){var t=e();return i.push({d:t,resolve:n,reject:r}),t.promise},u=function(e,v,s){for(var a=0,p=i.length;p>a;a++){var h=i[a],l=h.d,d=h[e];typeof d!==t?l[e](v):r(d,v,l)}c=n(f,v,s),u=o}}(),{resolve:function(e){u("resolve",e,!0)},reject:function(e){u("reject",e,!1)},promise:f}}function n(n,o,c){return function(u,f){var i,v=c?u:f;return typeof v!==t?n:(setTimeout(r.bind(n,v,o,i=e())),i.promise)}}function r(e,n,r){try{var o=e(n);o&&typeof o.then===t?o.then(r.resolve,r.reject):r.resolve(o)}catch(c){r.reject(c)}}var t="function",o=function(){};window.promiscuous={resolve:function(e){var r={};return r.then=n(r,e,!0),r},reject:function(e){var r={};return r.then=n(r,e,!1),r},deferred:e}})();
  }(utils));

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
    var readyDfd;

    if ( !(options.id && options.origin && options.target) ) {
      throw new Error('id, origin, and target options are required');
    }

    var scope = options.id;
    var origin = options.origin;
    var targetWindow = options.target;
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

    function sendMessage (method, data, dfdId, state) {
      targetWindow.postMessage({
        scope: scope,
        dfdId: dfdId,
        data: data,
        method: method,
        state: state
      }, origin);
    }

    window.addEventListener('message', function (event) {
      var message = event.data || {};
      if (event.origin !== origin || message.scope !== scope || !message.method) {
        return;
      }
      if (internalMethods[message.method]) {
        internalMethods[message.method](message);
      }
      else if (message.dfdId !== undefined && methods[message.method]) {
        var asyncDfd;
        var done = function (data, state) {
          sendMessage(callbackMethod, data, message.dfdId, state);
        };
        var context = {
          async: function () {
            asyncDfd = Deferred();
            return asyncDfd;
          }
        };

        var result = methods[message.method].call(context, message.data);
        if (asyncDfd) {
          asyncDfd.promise.then(
            done,
            function fail (d) {
              done(d, 'reject');
            }
          );
        } else {
          // For methods that just return this, detect that and return undefined instead
          // because functions (such as async, above) can't be passed via postMessage.
          done(result === context ? undefined : result);
        }
      }
    });

    this.reset = function () {
      readyDfd = Deferred();
      readyDfd.promise.then(function () {
        // Send back to frame that said it was ready that we're also ready
        sendMessage(readyMethod);
      });
    }

    this.addMethod = function (method, fn) {
      methods[method] = fn;
    };

    this.removeMethod = function (method) {
      delete methods[method];
    };

    this.run = function (method, data, timeout) {
      var dfdId = dfds.length;
      var dfd = Deferred();
      dfds.push(dfd);
      readyDfd.promise.then(function () {
        sendMessage(method, data, dfdId);
      });
      if (timeout) {
        window.setTimeout(dfd.reject, timeout);
      }
      return dfd.promise;
    };
    this.reset();
    // Broadcast that we're ready
    sendMessage(readyMethod);
  };

  if (typeof define === 'function' && define.amd) {
    define(function () { return postMessageChannel; });
  } else {
    exports.postMessageChannel = postMessageChannel;
  }
}(this));