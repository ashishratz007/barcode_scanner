
/// global keys
var barcodeKey = "Barcode";
// Main function to handle barcode generation, object duplication, and EPS export
function generateBarcodesAndExportObjects() {
    var doc = app.activeDocument;
    var docPath = doc.path; // Get the directory where the AI file exists
    var docName = doc.name.replace(/\.[^\.]+$/, ""); // Remove extension from file name

    // Step 1: Create a folder with the same name as the AI file
    var exportFolder = new Folder(docPath + "/" + docName);
    if (!exportFolder.exists) {
        exportFolder.create();
    }

    // Step 2: Get "Layer 1" and validate its objects
    var layerName = "Layer 1";
    var mainLayer;
    try {
        mainLayer = doc.layers.getByName(layerName);
    } catch (e) {
        alert("Layer '" + layerName + "' not found!");
        return;
    }

    // Check if barcodes have already been generated
    if (checkIfBarcodesGenerated(mainLayer)) {
        alert("Barcodes already generated! Delete all barcode Layers to regenerate.");
        return;
    }

    var objects = [];
    findObjects(mainLayer, objects);

    if (objects.length === 0) {
        alert("No valid objects found in '" + layerName + "'!");
        return;
    } else {
        alert("Total objects detected: " + objects.length);
    }

    // Step 3: Assign unique barcodes and export each object
    for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];

        // Check if the object already has a barcode
        if (obj.userData && obj.userData.barcode) {
            alert("Object already has a barcode: " + obj.userData.barcode);
            return; // Exit the function or skip this object
        }

        // Generate a unique scannable barcode
        var inputCode = generateScannableBarcode(i);
        var checkDigit = calculateEAN13CheckDigit(inputCode);
        var fullEAN = inputCode + checkDigit;

        // Store the barcode in the object's userData
        obj.userData = { barcode: fullEAN };

        // Get object bounds
        var objBounds = obj.geometricBounds; // [left, top, right, bottom]
        var objWidth = objBounds[2] - objBounds[0];  // Object width
        var objHeight = objBounds[1] - objBounds[3]; // Object height

        // **1. Add Barcode to Existing Document (Centered Below Object)**
        var barcodeWidth = 180; // Set barcode width
        var barcodeX = objBounds[0] + (objWidth - barcodeWidth) / 2; // Center barcode
        var barcodeY = objBounds[3] - 20; // Position barcode 20px below the object
        {
            // Create a sublayer inside the object's parent layer
            var objectLayer = obj.layer;
            var barcodeLayer = objectLayer.layers.add();
            barcodeLayer.name = "Barcode for Object " + (i + 1);
            drawEAN13Barcode(fullEAN, barcodeX, barcodeY, barcodeWidth, 60, 70, barcodeLayer);
        }
        // **2. Create a new document with the same artboard size as the original document**
        var originalArtboard = doc.artboards[0]; // Assuming there's only one artboard
        var artboardRect = originalArtboard.artboardRect; // [left, top, right, bottom]
        var artboardWidth = artboardRect[2] - artboardRect[0];
        var artboardHeight = artboardRect[1] - artboardRect[3];

        var newDoc = app.documents.add(DocumentColorSpace.CMYK, artboardWidth, artboardHeight);
        app.activeDocument = newDoc;

        // **3. Copy the object to the new document and align it to the top-left**
        var copiedObject = obj.duplicate(newDoc, ElementPlacement.PLACEATBEGINNING);

        // Align to top-left of the new artboard
        var newArtboardRect = newDoc.artboards[0].artboardRect; // [left, top, right, bottom]
        var newLeft = newArtboardRect[0]; // Leftmost x-position
        var newTop = newArtboardRect[1]; // Topmost y-position

        copiedObject.position = [newLeft, newTop];

        // **4. Add Barcode to the New Document (Bottom Center with 20px Padding)**
        var copiedBounds = copiedObject.geometricBounds; // [left, top, right, bottom]
        var copiedWidth = copiedBounds[2] - copiedBounds[0];  // Object width
        var copiedHeight = copiedBounds[1] - copiedBounds[3]; // Object height

        var barcodeWidth = 180; // Set barcode width
        var barcodeX = copiedBounds[0] + (copiedWidth - barcodeWidth) / 2; // Center barcode horizontally
        var barcodeY = copiedBounds[3] - 20; // Place barcode 20px below the object
        {
            // Create a sublayer inside the object's parent layer
            var objectLayer = copiedObject.layer;
            var barcodeLayer = objectLayer.layers.add();
            barcodeLayer.name = "Barcode for Object " + (i + 1);
              // Mark that barcodes have been generated
            markBarcodesGenerated(objectLayer);
            drawEAN13Barcode(fullEAN, barcodeX, barcodeY, barcodeWidth, 60, 70, barcodeLayer);
        }
        // **5. Export the EPS file**
        var filePath = new File(exportFolder.fsName + "/" + fullEAN + ".eps");
        saveDocAsEPS(newDoc, filePath);

        // Close the new document without saving
        newDoc.close(SaveOptions.DONOTSAVECHANGES);
    }
    // Mark that barcodes have been generated
    markBarcodesGenerated(mainLayer);

    alert("Barcodes generated and files exported successfully to: " + exportFolder.fsName);
}

// Function to mark that barcodes have been generated
function markBarcodesGenerated(layer) {
    var markerLayer = layer.layers.add();
    markerLayer.name = barcodeKey;
}


// Function to find all objects inside layers
function findObjects(layer, objects) {
    for (var i = 0; i < layer.pageItems.length; i++) {
        var item = layer.pageItems[i];
        if (item.typename === "PathItem" || item.typename === "CompoundPathItem" || item.typename === "GroupItem") {
            objects.push(item);
        }
    }

    for (var j = 0; j < layer.layers.length; j++) {
        findObjects(layer.layers[j], objects);
    }
}

// Function to Generate a Scannable 12-digit Barcode
function generateScannableBarcode(index) {
    var prefix = "12345"; // Fixed prefix
    var now = new Date();
    var timestamp = ("0" + now.getHours()).slice(-2) +
        ("0" + now.getMinutes()).slice(-2) +
        ("0" + now.getSeconds()).slice(-2);
    var uniqueID = ("00" + index).slice(-3); // Unique 3-digit ID
    return prefix + timestamp + uniqueID;
}

// Function to Calculate EAN-13 Check Digit
function calculateEAN13CheckDigit(code) {
    var sum = 0;
    for (var i = 0; i < 12; i++) {
        sum += (i % 2 === 0 ? 1 : 3) * parseInt(code[i], 10);
    }
    var remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
}

// Function to Draw EAN-13 Barcode inside the object's sublayer
function drawEAN13Barcode(ean, x, y, width, height, textPadding, barcodeLayer) {
    var doc = app.activeDocument;
    var moduleWidth = width / 95; // Scale barcode width to keep proportions
    var moduleHeight = height;

    // Create black fill color
    var blackColor = new CMYKColor();
    blackColor.black = 100; // Full black

    var patterns = {
        "0": "0001101", "1": "0011001", "2": "0010011", "3": "0111101", "4": "0100011",
        "5": "0110001", "6": "0101111", "7": "0111011", "8": "0110111", "9": "0001011"
    };

    var rightPatterns = {
        "0": "1110010", "1": "1100110", "2": "1101100", "3": "1000010", "4": "1011100",
        "5": "1001110", "6": "1010000", "7": "1000100", "8": "1001000", "9": "1110100"
    };

    var guard = "101";
    var center = "01010";

    var startX = x;
    drawBars(guard, startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);
    startX += guard.length * moduleWidth;

    for (var i = 0; i < 6; i++) {
        drawBars(patterns[ean[i]], startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);
        startX += 7 * moduleWidth;
    }

    drawBars(center, startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);
    startX += center.length * moduleWidth;

    for (var i = 6; i < 12; i++) {
        drawBars(rightPatterns[ean[i]], startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);
        startX += 7 * moduleWidth;
    }

    drawBars(guard, startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);

    // Add barcode number below barcode with 20px padding
    var text = barcodeLayer.textFrames.add();
    text.contents = ean;
    text.textRange.characterAttributes.size = 14;
    text.textRange.characterAttributes.fillColor = blackColor; // Make text black

    // Center align text below barcode
    var textX = x + (width / 2) - (text.width / 2); // Center horizontally
    var textY = y - textPadding; // 20px below barcode
    text.position = [textX, textY];
}

// Function to Draw Bars with Proper Thickness and Filled Black Color
function drawBars(binary, x, y, width, height, blackColor, barcodeLayer) {
    var doc = app.activeDocument;
    for (var i = 0; i < binary.length; i++) {
        if (binary[i] === "1") {
            var rect = barcodeLayer.pathItems.rectangle(y, x + (i * width), width, height);
            rect.filled = true;
            rect.fillColor = blackColor; // **Fill bars in black**
            rect.stroked = false; // **No stroke**
        }
    }
}

// Function to save as EPS
function saveDocAsEPS(doc, file) {
    var saveOptions = new EPSSaveOptions();
    saveOptions.compatibility = Compatibility.ILLUSTRATOR10;
    saveOptions.preview = EPSPreview.None;
    saveOptions.embedLinkedFiles = false;

    try {
        doc.saveAs(file, saveOptions);
    } catch (e) {
        alert("Error saving: " + file.fsName);
    }
}

// Function to check if barcodes have already been generated
function checkIfBarcodesGenerated(layer) {
    for (var i = 0; i < layer.layers.length; i++) {
        if (layer.layers[i].name === barcodeKey) {
            return true;
        }
    }
    return false;
}

// Run the main function
generateBarcodesAndExportObjects();