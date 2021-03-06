/*
 * proxy-table-test.js: Tests for the ProxyTable object.
 *
 * (C) 2010, Charlie Robbins
 *
 */

var fs = require('fs'),
    vows = require('vows'),
    util = require('util'),
    path = require('path'),
    request = require('request'),
    assert = require('assert'),
    helpers = require('./helpers'),
    argv = require('optimist').argv,
    TestRunner = helpers.TestRunner;
  
var protocol = argv.https ? 'https' : 'http',
    runner = new TestRunner(protocol),
    routeFile = path.join(__dirname, 'config.json');

var fileOptions = {
  router: {
    "foo.com": "127.0.0.1:8101",
    "bar.com": "127.0.0.1:8102"
  }
};

var defaultOptions = {
  router: {
    "foo.com": "127.0.0.1:8091",
    "bar.com": "127.0.0.1:8092"
  }
};

var hostnameOptions = {
  hostnameOnly: true,
  router: {
    "foo.com": "127.0.0.1:8091",
    "bar.com": "127.0.0.1:8092"
  }
};

vows.describe('node-http-proxy/proxy-table/' + protocol).addBatch({
  "When using server created by httpProxy.createServer()": {
    "when passed a routing table": {
      "and routing by RegExp": {
        topic: function () {
          this.server = runner.startProxyServerWithTable(8090, defaultOptions, this.callback);
        },
        "an incoming request to foo.com": runner.assertProxied('foo.com', 8090, 8091),
        "an incoming request to bar.com": runner.assertProxied('bar.com', 8090, 8092),
        "an incoming request to unknown.com": runner.assertResponseCode(8090, 404)
      },
      "and routing by Hostname": {
        topic: function () {
          this.server = runner.startProxyServerWithTable(8093, hostnameOptions, this.callback);
        },
        "an incoming request to foo.com": runner.assertProxied('foo.com', 8093, 8094),
        "an incoming request to bar.com": runner.assertProxied('bar.com', 8093, 8095),
        "an incoming request to unknown.com": runner.assertResponseCode(8093, 404)
      }
    },
    "when passed a routing file": {
      topic: function () {
        fs.writeFileSync(routeFile, JSON.stringify(fileOptions));
        this.server = runner.startProxyServerWithTable(8100, {
          router: routeFile
        }, this.callback);
      },
      "an incoming request to foo.com": runner.assertProxied('foo.com', 8100, 8101),
      "an incoming request to bar.com": runner.assertProxied('bar.com', 8100, 8102),
      "an incoming request to unknown.com": runner.assertResponseCode(8100, 404),
      "an incoming request to dynamic.com": {
        "after the file has been modified": {
          topic: function () {
            var that = this,
                data = fs.readFileSync(routeFile),
                config = JSON.parse(data);

            config.router['dynamic.com'] = "127.0.0.1:8103"
            fs.writeFileSync(routeFile, JSON.stringify(config));
            
            this.server.on('routes', function () {
              var options = {
                method: 'GET', 
                uri: 'http://localhost:8100',
                headers: {
                  host: 'dynamic.com'
                }
              };

              runner.startTargetServer(8103, 'hello dynamic.com', function () {
                request(options, that.callback);
              });
            });
          },
          "should receive 'hello dynamic.com'": function (err, res, body) {
            assert.equal(body, 'hello dynamic.com');
          }
        }
      }
    }
  }
}).addBatch({
  "When using an instance of ProxyTable combined with HttpProxy directly": {
    topic: function () {
      this.server = runner.startProxyServerWithTableAndLatency(8110, 100, {
        router: {
          'foo.com': 'localhost:8111',
          'bar.com': 'localhost:8112'
        }
      }, this.callback);
    },
    "an incoming request to foo.com": runner.assertProxied('foo.com', 8110, 8111),
    "an incoming request to bar.com": runner.assertProxied('bar.com', 8110, 8112),
    "an incoming request to unknown.com": runner.assertResponseCode(8110, 404)
  }
}).addBatch({
  "When the tests are over": {
    topic: function () {
      //fs.unlinkSync(routeFile);
      return runner.closeServers();
    },
    "the servers should clean up": function () {
      assert.isTrue(true);
    }
  }
}).export(module);