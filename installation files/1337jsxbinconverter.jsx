var CONVERTER_FOLDER = "C:/Temp/converter";


/* Do not edit below this line */
var CONVERTER_FILEPATH = CONVERTER_FOLDER + "/runner.cmd";
var CONVERTER_ENCODED_FILEPATH = CONVERTER_FOLDER + "/encoded.jsxbin";
var CONVERTER_DECODED_FILEPATH = CONVERTER_FOLDER + "/decoded.jsx";
var CONVERTER_IPC_FILEPATH = CONVERTER_FOLDER + "/converter.ipc";
app.convertJsxbinToJsx = function(jsxbinFile) {
	var f = jsxbinFile;
	var converter = File(CONVERTER_FILEPATH);			
	if (f.fullName.indexOf(".jsxbin", f.fullName.length - ".jsxbin".length) !== -1) {
		ipc = File(CONVERTER_IPC_FILEPATH);
		ipc.open('w', undefined, undefined);
		ipc.write("lock");
		ipc.close();
		f.copy(CONVERTER_ENCODED_FILEPATH);
		converter.execute();
		var tries = 10;
		while (ipc.exists) {
			ipc = File(CONVERTER_IPC_FILEPATH);
			$.sleep(500);
			ipc.close();
			tries--;
			// Don't hang application if something went wrong.			
			if (tries == 0) {
				return jsxbinFile;
			}
		}
		decoded = File(CONVERTER_DECODED_FILEPATH);
	    var pos = f.fsName.lastIndexOf ('.');
	    var dest = f.fsName.substr(0, pos) + ".jsx";
		decoded.copy(dest);
		f = File(dest);
		converter.close();
		decoded.close();
	}
	return f;
}