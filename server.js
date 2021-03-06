var http = require('http'),
    https = require('https'),
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

// HTTPS 不验证
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

function onRequest(request, response) {
    var parsedURL = url.parse(request.url),
        pathname = parsedURL.pathname.substring(1);

    if (!pathname || pathname === 'favicon.ico') {
        sendPageNotFound(response);
        return;
    }

    var contentType = contentTypes[pathname],
        options = {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin' : allow
        };

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
        protocol = fetchURL.indexOf('https') === 0 ? https : http;

    try {
        log('url: ' + fetchURL + ' time: ' + (new Date()).toString());
        protocol.get(fetchURL, function(res) {
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
            error('url: ' + fetchURL + ' time: ' + (new Date()).toString() + ' error:' + e);
            sendPageNotFound(response);
        });
    } catch(e) {
        error('url: ' + fetchURL + ' time: ' + (new Date()).toString());
    }
}

function filename() {
    var now = new Date(),
        y = now.getFullYear(),
        m = now.getMonth() + 1,
        d = now.getDate();
    if (m < 10) {
        m = '0' + m;
    }
    if (d < 10) {
        d = '0' + d;
    }
    return y + m + d + '.log';
}

function log(text) {
    var now = new Date(),
        prefix = 'log-';
    append(prefix + filename(), text);
}

function error(text) {
    var now = new Date(),
        prefix = 'error-';
    append(prefix + filename(), text);
}

function append(filename, text) {
    console.log(text);
    var dir = 'logs/';
    fs.readdir(dir, function(err, files) {
        if (!files) {
            fs.mkdirSync(dir);
        }
    });
    fs.appendFile(dir + filename, text + '\n');
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

    log('Cross-Domain Fetcher Server has started, listening ' + port + '.');

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