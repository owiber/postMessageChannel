postMessageChannel
==================

Cross-domain channel communication. Provides similar functionality to [pmrpc](https://github.com/izuzak/pmrpc) and [jschannel](https://github.com/mozilla/jschannel) but with an alternative API.

postMessageChannel allows you to setup a channel between two frames. You may then send data to functions of the other frame and receive data back. A scape is defined for a channel so that multiple channels may exist on a page and not conflict.

## Examples

### parent.html

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>This is the parent</title>
    <script src="postMessageChannel.js" type="text/javascript"></script>
  </head>
  <body>
    <iframe id="childFrame" src="child.html"></iframe>
    <script type="text/javascript">
      (function () {
        var pmc = postMessageChannel({
          window: document.getElementById('childFrame').contentWindow,
          origin: window.location.origin,
          scope: 'myScope'
        });

        var result = pmc.run('hello', { subject: 'world' });
        
        // .run() returns a promise we can use to receive data back from the other frame
        result.then(function (data) {
          console.log('Got back', data);
        });
      }());
    </script>
  </body>
</html>
```

### child.html

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>This is the child</title>
    <script src="postMessageChannel.js" type="text/javascript"></script>
  </head>
  <body>
    This is the child iframe.
    <script type="text/javascript">
      (function () {
        var pmc = postMessageChannel({
          window: parent,
          origin: window.location.origin,
          scope: 'myScope',
          methods: {
            hello: function (data) {
              data = data || {};
              return 'hello, ' + data.subject + '!';
            }
          }
        });

      }());
    </script>
  </body>
</html>
```

### Timeouts

If you want requests to timeout, pass a third parameter to `run()`:

```javascript
pmc.run('dummy', null, 1000).then(
  function success () {
    console.log('success'); // This won't run.
  }, 
  function failure () {
    console.log('This timed out! (Expected)');
  }
);
```

### Async Methods

Methods may be asynchronous. Use `this.async();` and then call the returned function when finished.

```javascript
var pmc = postMessageChannel({
  window: parent,
  origin: window.location.origin,
  scope: 'myScope',
  methods: {
    asyncFn: function (data) {
      var done = this.async();
      window.setTimeout(function () {
        done('result');
      }, 1000);
    }
  }
});
```
