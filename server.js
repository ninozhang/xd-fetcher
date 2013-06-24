var http = require('http'),
    fs = require('fs'),
    url = require('url'),
    querystring = require('querystring'),
    commander = require('commander'),
    config = require('./config.js');

var port = config.port,
    allow = config.allow || '*',
    httpServer,
    contentTypes = {
        'html': 'text/html',
        'json': 'application/json',
        'text': 'text/plain'
    };

function onRequest(request, response) {
    var parsedURL = url.parse(request.url),
        pathname = parsedURL.pathname.substring(1);

    if (!pathname || pathname === 'favicon.ico') {
        sendPageNotFound(response);
        return;
    }

    var contentType = contentTypes[pathname];

    if (!contentType) {
        sendPageNotFound(response);
        return;
    }

    var query = querystring.parse(parsedURL.query),
        fetchURL = query.url,
        fetchOptions = url.parse(fetchURL),
        callback = query.callback,
        cache = query.cache === 'true',
        text = '',
        options = {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin' : allow
        };

    try {
        log('url: ' + fetchURL + ' time: ' + (new Date()).toString());
        http.get(fetchURL, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                text += chunk;
            }).on('end', function() {
                if (callback) {
                    text = callback + '(' + text + ')';
                }
                response.writeHead(200, options);
                response.write(text);
                response.end();
            });
        }).on('error', function(e) {
            sendPageNotFound(response);
        });
    } catch(e) {
        error('url: ' + fetchURL + ' time: ' + (new Date()).toString());
    }
}

function log(text) {
    var now = new Date(),
        dir = 'log/',
        filename = dir + 'log-' + now.getFullYear() + (now.getMonth() + 1) + now.getDate() + '.log';
    append(dir, filename, text);
}

function error(text) {
    var now = new Date(),
        dir = 'log/',
        filename = dir + 'err-' + now.getFullYear() + (now.getMonth() + 1) + now.getDate() + '.log';
    append(dir, filename, text);
}

function append(dir, filename, text) {
    fs.readdir(dir, function(err, files) {
        if (!files) {
            fs.mkdirSync(dir);
        }
        fs.appendFile(filename, text + '\n');
    });
}

function sendPageNotFound(response) {
    response.writeHead(404, {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin' : '*'
    });
    response.end();
}

function start(port, pidFile) {
    var address;

    if (!port) {
        commander.option('-p, --port <number>', 'server port')
            .option('-P, --pidfile <path>', 'path of pidfile')
            .parse(process.argv);
        port = commander.port && parseFloat(commander.port);
        pidFile = commander.pidfile;
    }
    if (!port) {
        port = config.port;
    }

    httpServer = http.createServer(onRequest).listen(port);
    address = httpServer.address();

    console.log('Cross-Domain Fetcher Server has started, listening ' + port + '.');

    if (pidFile) {
        fs.writeFileSync(pidFile, process.pid);
        process.on('SIGINT', function () {
            if (fs.existsSync(pidFile)) {
                fs.unlinkSync(pidFile);
            }
            process.kill(process.pid);
        });
    }
}

start();