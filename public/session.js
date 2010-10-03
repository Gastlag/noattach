var send;

if (!window.console) {
    var stub = function() { };
    window.console = { log: stub, warn: stub, error: stub };
}

function humanSize(size) {
    var units = ['T', 'G', 'M', 'K'];
    var unit = '';
    while(size >= 1024 && units.length > 0) {
	size /= 1024;
	unit = units.pop();
    }
    return (Math.round(size * 10) / 10) + ' ' +
	unit + 'B';
}

function Share(file, shareInfo) {
    this.id = shareInfo.id;
    this.file = file;

    var div = $('<div class="box"><p class="name"></p><p class="righticon"><a class="remove" target="_blank" title="Remove">[rm]</a></p><p class="size"></p></div>');
    div.find('.name').text(shareInfo.name);
    div.find('.size').text(humanSize(shareInfo.size));
    $('#shares').append(div);
    this.div = div;
}

Share.prototype.upload = function(token, by) {
    var that = this;

    var up = new UploadProgress(this.div, by);
    var shut = function() {
	up.end();
    };
    var reader = new FileReader();
    reader.onload = function() {
	console.log('read '+reader.result.length);
	$.ajax({ url: document.location.pathname +
		      '/f' + that.id + '/' + token,
		 type: 'POST',
		 data: window.btoa(reader.result),
		 beforeSend: function(xhr) {
		     up.trackXHR(xhr);
		 },
		 success: shut,
		 error: shut
	       });
    };
    reader.onabort = shut;
    reader.onerror = shut;
    // give some time to render UploadProgress
    window.setTimeout(function() {
	reader.readAsBinaryString(that.file);
    }, 10);

    console.log(reader);
};

function UploadProgress(parent, by) {
    var p = $('<p class="upload"><canvas width="100" height="16"></canvas> <span class="by"></span></p>');
    this.p = p;
    parent.append(p);

    if (by)
	p.find('.by').text(by);

    this.progress = -1;
    this.draw();
}

UploadProgress.prototype.draw = function() {
    if (!this.canvas)
	this.canvas = this.p.find('canvas')[0];
    var ctx = this.canvas.getContext('2d');
    var w = this.canvas.width, h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    var line = function(x1, y1, x2, y2) {
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
    };

    /*line(0, 1, 0, h - 2);  // left
    line(1, 0, w - 2, 0);  // top
    line(1, h - 1, w - 2, h - 1);  // bottom
    line(w - 1, 1, w - 1, h - 2);  // right*/

    ctx.globalAlpha = 0.5;
    if (this.prototype < 0) {
	ctx.fillStyle = '#800000';
	ctx.fillRect(1, 1, w - 2, h - 2);
    } else {
	ctx.fillStyle = '#AA0000';
	ctx.fillRect(1, 1, this.progress * (w - 2), h - 2);
    }
};

UploadProgress.prototype.trackXHR = function(xhr, by) {
    var that = this;

    if (!xhr.upload) {
	console.error('not receiving upload notifications');
	this.end();
	return;
    }

    xhr.upload.onloadstart = function() {
	that.progress = 0;
	that.draw();
    };
    xhr.upload.onprogress = function(ev) {
	that.progress = ev.position / ev.totalSize;
	that.draw();
	console.log({progress:ev});
    };
    xhr.upload.onloadend = function() {
	that.end();
    };

    console.log(xhr.upload);
};

UploadProgress.prototype.end = function() {
    this.p.remove();
};

function RemoteShare(shareInfo) {
    var li = $('<li><a href="#"></a> <span class="meta"><span class="size"></span></span></li>');
    var a = li.find('a');
    a.text(shareInfo.name);
    a.attr('href', document.location.pathname + '/f' + shareInfo.id);
    var size = li.find('.size');
    size.text(humanSize(shareInfo.size));
    if (shareInfo.by) {
	var by = $('<span class="by"></span>');
	by.text(shareInfo.by);
	li.find('.meta').append(' by ').append(by);
    }

    li.hide();
    li.slideDown(500);
    $('#remote').append(li);
}

var fileCache = {};

function fileChosen(ev) {
    var files = $('#file')[0].files;
    for(var i = 0; i < files.length; i++) {
	var file = files.item(i);
	fileCache[file.name] = file;

	send({ share: { name: file.name,
			size: file.size,
			type: file.type } });
    }
    $('#file')[0].value = null;
};



var shares = {};

$(document).ready(function() {
    var socket = new io.Socket(null, {transports:['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling']});
    socket.connect();

    send = function(json) {
	socket.send(JSON.stringify(json));
    };

    socket.on('connect', function(){
	send({ join: document.location.pathname });
	$('#dashboard').show();
    });
    socket.on('message', function(data){
console.log(data);
	var json;
	try {
	    json = JSON.parse(data);
	} catch (x) {
	    console.error("Cannot parse: " + message);
	    return;
	}

	if (json.shared && json.shared.id !== null) {
	    // Own share confirmed
	    if (fileCache[json.shared.name]) {
		shares[json.shared.id] = new Share(fileCache[json.shared.name], json.shared);
	    } else {
		send({ unshare: { id: json.shared.id } });
	    }
	}
	if (json.share && json.share.id) {
	    // New remote share
	    shares[json.share.id] = new RemoteShare(json.share);
	}
	if (json.transfer) {
	    // TODO: implement long path for error case
	    shares[json.transfer.id].upload(json.transfer.token, json.transfer.by);
	}
    });

    /* New file */
    $('#file').bind('change', fileChosen);
});

