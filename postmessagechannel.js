(function (exports) {

  var callbackMethod = '__postMessageChannel_callback';
  var readyMethod = '__postMessageChannel_ready';
  var utils = {
    eventOn: function (evt, fn, tgt) {
      if (evt && typeof fn === 'function') {
        var target = tgt || window;
        if (target.addEventListener) {
          target.addEventListener(evt, fn, false);
        } else if (target.attachEvent) {
          target.attachEvent('on' + evt, fn);
        }
      }
    },
    eventOff: function (evt, fn, tgt) {
      if (evt && typeof fn === 'function') {
        var target = tgt || window;
        if (target.removeEventListener) {
          target.removeEventListener(evt, fn, false);
        } else if (target.detachEvent) {
          target.detachEvent('on' + evt, fn);
        }
      }
    }
  };

  (function () {
    /** @license MIT - promiscuous library - ©2013 Ruben Verborgh */
    (function promiscuous() {
      var func = "function", obj = "object";

      // Creates a deferred: an object with a promise and corresponding resolve/reject methods
      function createDeferred() {
        // The `handler` variable points to the function that will
        // 1) handle a .then(onFulfilled, onRejected) call
        // 2) handle a .resolve or .reject call (if not fulfilled)
        // Before 2), `handler` holds a queue of callbacks.
        // After 2), `handler` is a simple .then handler.
        // We use only one function to save memory and complexity.
        var handler = function handlerFunction(onFulfilled, onRejected, value) {
              // Case 1) handle a .then(onFulfilled, onRejected) call
              if (onFulfilled !== promiscuous) {
                var d = createDeferred();
                handler.c.push({ d: d, resolve: onFulfilled, reject: onRejected });
                return d.promise;
              }

              // Case 2) handle a .resolve or .reject call
              // (`onFulfilled` acts as a sentinel)
              // The actual function signature is
              // .re[ject|solve](sentinel, success, value)

              // Check if the value is a promise and try to obtain its `then` method
              var then;
              if (value !== null && (typeof value === obj || typeof value === func)) {
                try { then = value.then; }
                catch (reason) { onRejected = false; value = reason; }
              }
              // If the value is a promise, take over its state
              if (typeof then === func) {
                // Make a local copy of the _current_ handler
                onFulfilled = handler;
                try {
                  then.call(this, function (value) {
                    then && (then = null, onFulfilled(promiscuous, true, value));
                  },
                  function (reason) {
                    then && (then = null, onFulfilled(promiscuous, false, reason));
                  });
                }
                catch (reason) {
                  then && (then = null, onFulfilled(promiscuous, false, reason));
                }
              }
              // The value is not a promise; handle resolve/reject
              else {
                var action = onRejected ? 'resolve' : 'reject', queue = handler.c;
                for (var i = 0, l = queue.length; i < l; i++) {
                  var c = queue[i], deferred = c.d, callback = c[action];
                  // If no callback, just fulfill the promise
                  if (typeof callback !== func)
                    deferred[action](value);
                  // Otherwise, fulfill the promise with the result of the callback
                  else
                    execute(callback, value, deferred);
                }
                // Replace this handler with a simple resolved or rejected handler
                handler = createHandler(promise, value, onRejected);
              }
            },
            promise = {
              then: function (onFulfilled, onRejected) {
                return handler(onFulfilled, onRejected);
              }
            };
        // The queue of deferreds
        handler.c = [];

        return {
          promise: promise,
          // Only resolve / reject when there is a deferreds queue
          resolve: function (value)  { handler.c && handler(promiscuous, true, value); },
          reject : function (reason) { handler.c && handler(promiscuous, false, reason); }
        };
      }

      // Creates a fulfilled or rejected .then function
      function createHandler(promise, value, success) {
        return function (onFulfilled, onRejected) {
          var callback = success ? onFulfilled : onRejected, result;
          if (typeof callback !== func)
            return promise;
          execute(callback, value, result = createDeferred());
          return result.promise;
        };
      }

      // Executes the callback with the specified value,
      // resolving or rejecting the deferred
      function execute(callback, value, deferred) {
        setTimeout(function () {
          try {
            // Return the result if it's not a promise
            var result = callback(value),
                then = (result !== null && (typeof result === obj || typeof result === func)) && result.then;
            if (typeof then !== func)
              deferred.resolve(result);
            // If it's a promise, make sure it's not circular
            else if (result === deferred.promise)
              deferred.reject(new TypeError());
            // Take over the promise's state
            else
              then.call(result, deferred.resolve, deferred.reject);
          }
          catch (error) {
            deferred.reject(error);
          }
        });
      }

      utils.promiscuous = {
        // Returns a resolved promise
        resolve: function (value) {
          var promise = {};
          promise.then = createHandler(promise, value, true);
          return promise;
        },
        // Returns a rejected promise
        reject: function (reason) {
          var promise = {};
          promise.then = createHandler(promise, reason, false);
          return promise;
        },
        // Returns a deferred
        deferred: createDeferred
      };
    })();

  }());

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
    var isReady = false;

    if ( !(options.id && options.origin) ) {
      throw new Error('id and origin are required');
    }
    if ( !(options.target || options.targetFrame) ) {
      throw new Error('one of either target or targetFrame is required');
    }

    var scope = options.id;
    var origin = options.origin;
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

    function targetWindow () {
      return options.target || options.targetFrame.contentWindow;
    }

    function sendMessage (method, data, dfdId, state) {
      var messageData = {
        scope: scope,
        dfdId: dfdId,
        data: data,
        method: method,
        state: state
      };
      targetWindow().postMessage(JSON.stringify(messageData), origin);
    }

    function messageHandler (event) {
      var message = {};
      try {
        message = JSON.parse(event.data);
      } catch (e) {
        message = event.data || {};
      }
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
    }
    utils.eventOn('message', messageHandler);
    this.reset = function () {
      readyDfd = Deferred();
      isReady = false;
      readyDfd.promise.then(function () {
        isReady = true;
        // Send back to frame that said it was ready that we're also ready
        sendMessage(readyMethod);
      });
    };

    this.addMethod = function (method, fn) {
      methods[method] = fn;
    };

    this.removeMethod = function (method) {
      delete methods[method];
    };

    this.destroy = function () {
      utils.eventOff('message', messageHandler);
      isReady = false;
      this.run = function () {
        var dfd = Deferred();
        dfd.reject();
        return dfd.promise;
      };
    };

    this.ready = function () {
      return isReady;
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
    // Broadcast that we're ready if we're a child frame.
    // Note that we're broadcasting to all origins here.
    if (window.self !== window.top) {
      targetWindow().postMessage(JSON.stringify({
        scope: scope,
        method: readyMethod
      }), '*');

    }
  };

  postMessageChannel.utils = utils;

  if (typeof define === 'function' && define.amd) {
    define(function () { return postMessageChannel; });
  } else {
    exports.postMessageChannel = postMessageChannel;
  }
}(this));