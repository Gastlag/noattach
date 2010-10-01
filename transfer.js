var sys = require('sys');
var EventEmitter = require('events').EventEmitter;

function Transfer(shareInfo, req, res) {
    var that = this;
    EventEmitter.call(this);

    this.shareInfo = shareInfo;
    this.downReq = req;
    this.downRes = res;  // HTTP response

    res.writeHead(200, { 'Content-Type': 'binary/octet-stream',
			 'Content-Disposition': 'attachment; filename=' + shareInfo.name,
			 'Content-Length': shareInfo.size });

    req.on('error', function() {
	that.end();
    });

    this.timeout = setTimeout(function() {
	that.end();
    }, 30 * 1000);
}
sys.inherits(Transfer, EventEmitter);
module.exports.Transfer = Transfer;

Transfer.prototype.acceptUpload = function(req, res) {
    var that = this;

    this.emit('invalidate');
    this.upReq = req;
    this.upRes = res;

    req.on('data', function(data) {
	var written = that.downRes.write(data);
	if (!written)
	    req.socket.pause();
    });
    req.downRes.socket.on('drain', function() {
	req.socket.resume();
    });
    req.on('end', function() {
	that.end();
    });

    res.writeHead(200, { });
};

Transfer.prototype.end = function() {
    if (this.upRes) {
	this.upRes.end();
    } else
	this.emit('invalidate');

    this.downRes.end();
};

