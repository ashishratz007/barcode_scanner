if (app.documents.length > 0) {
    var doc = app.activeDocument;
    
    var filePath = doc.path; // Get document path
    var fileName = doc.name.replace(/\.[^\.]+$/, ""); // Remove extension
    var outputFile = new File(filePath + "/" + fileName + ".png");

    var exportOptions = new ExportOptionsPNG24();
    exportOptions.antiAliasing = true;
    exportOptions.transparency = true;
    exportOptions.artBoardClipping = false; // Export the whole document
    exportOptions.horizontalScale = 100;
    exportOptions.verticalScale = 100;

    // Export PNG
    doc.exportFile(outputFile, ExportType.PNG24, exportOptions);

    // Check file size
    if (outputFile.exists) {
        if (outputFile.length > 100 * 1024) { // 100KB in bytes
            alert("PNG file '" + fileName + ".png' exceeds 100KB (" + Math.round(outputFile.length / 1024) + "KB)");
        } else {
            alert("PNG file '" + fileName + ".png' created successfully and is under 100KB.");
        }
    } else {
        alert("PNG export failed.");
    }
} else {
    alert("No active document found.");
}
