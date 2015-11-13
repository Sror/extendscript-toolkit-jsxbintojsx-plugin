var CONVERTER_FOLDER = "C:/Temp/converter";


/* Do not edit below this line */
var CONVERTER_FILEPATH = CONVERTER_FOLDER + "/runner.cmd";
var CONVERTER_ENCODED_FILEPATH = CONVERTER_FOLDER + "/encoded.jsxbin";
var CONVERTER_DECODED_FILEPATH = CONVERTER_FOLDER + "/decoded.jsx";
app.convertJsxbinToJsx = function(jsxbinFile) {
	var f = jsxbinFile;
	var converter = File(CONVERTER_FILEPATH);			
	if (f.fullName.indexOf(".jsxbin", f.fullName.length - ".jsxbin".length) !== -1) {
		f.copy(CONVERTER_ENCODED_FILEPATH);
		converter.execute();
		decoded = File(CONVERTER_DECODED_FILEPATH);
	    var pos = f.fsName.lastIndexOf ('.');
	    var dest = f.fsName.substr(0, pos) + ".jsx";
		decoded.copy(dest);
		f = File(dest);
	}
	return f;
}