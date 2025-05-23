
/// global keys
var barcodeKey = "Barcode";
var selectedMainLayer;

// Main function to handle barcode generation, object duplication, and EPS export
function main(barcodeData, layername) {
    var files = [];
    var doc = app.activeDocument;
    var docPath = doc.path; // Get the directory where the AI file exists
    var docName = doc.name.replace(/\.[^\.]+$/, ""); // Remove extension from file name

    // Step 1: Create a folder with the same name as the AI file
    var exportFolder = new Folder(docPath + "/" + docName);
    if (!exportFolder.exists) {
        exportFolder.create();
    }

    // Step 2: Get "Layer 1" and validate its objects
    // Step 2: Get the main layer and validate its objects
    var layers = doc.layers;
    var mainLayer;


    try {
        mainLayer = layers.getByName(layername);
        selectedMainLayer = mainLayer;
    } catch (e) {
        alert("Layer '" + layername + "' not found!");
        return;
    }

    // Check if barcodes have already been generated
    if (checkForBarcode()) {
        alert("Barcodes already generated! Delete all barcode Layers to regenerate.");
        return "error";
    }

    var objects = [];
    findObjects(mainLayer, objects);

    if (objects.length === 0) {
        alert("No valid objects found in '" + "docs" + "'!");
        return;
    } else {
        // alert("Total objects detected: " + objects.length);
    }

    var barcodeNumbers = barcodeData.split(",");

    // Step 3: Assign unique barcodes and export each object
    for (var i = 0; i < objects.length; i++) {
        var obj = objects[i];

        // Check if the object already has a barcode
        if (obj.userData && obj.userData.barcode) {
            alert("Object already has a barcode: " + obj.userData.barcode);
            return; // Exit the function or skip this object
        }

        // Get a unique scannable barcode
        var fullEAN = barcodeNumbers[i];
        // alert(fullEAN);

        // Store the barcode in the object's userData
        obj.userData = { barcode: fullEAN };

        // Get object bounds
        var objBounds = obj.geometricBounds; // [left, top, right, bottom]
        var objWidth = objBounds[2] - objBounds[0];  // Object width
        var objHeight = objBounds[1] - objBounds[3]; // Object height

        // **1. Add Barcode to Existing Document (Centered Below Object)**
        var barcodeWidth = 200; // Set barcode width
        var barcodeX = objBounds[0] + (objWidth - barcodeWidth) / 2; // Center barcode
        var barcodeY = objBounds[3] - 20; // Position barcode 20px below the object
		var mainLayerQRLayer ;
        {
            // Create a sublayer inside the object's parent layer
            var objectLayer = obj.layer;
            var barcodeLayer = objectLayer.layers.add();
            barcodeLayer.name = barcodeKey + " " + (i + 1);
            mainLayerQRLayer = generateQRCode(fullEAN, barcodeX, barcodeY, barcodeWidth, 150, 5, barcodeLayer);
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

        var barcodeWidth = 200; // Set barcode width
        var barcodeX = copiedBounds[0] + (copiedWidth - barcodeWidth) / 2; // Center barcode horizontally
        var barcodeY = copiedBounds[3] - 20; // Place barcode 20px below the object
        {
            // Create a sublayer inside the object's parent layer
            var objectLayer = copiedObject.layer;
            var barcodeLayer = objectLayer.layers.add();
            barcodeLayer.name = barcodeKey + " " + (i + 1);
            generateQRCode(fullEAN, barcodeX, barcodeY, barcodeWidth, 150, 5, barcodeLayer);
        }
        // **5. Export the EPS file**
        var filePath = new File(exportFolder.fsName + "/" + fullEAN + ".eps");
        saveDocAsEPS(newDoc, filePath);
        toPNG(newDoc);
        // Close the new document without saving
        files.push(exportFolder.fsName + "/" + fullEAN + ".eps");
        newDoc.close(SaveOptions.DONOTSAVECHANGES);
    }
    // Mark that barcodes have been generated
    // markBarcodesGenerated(mainLayer);
    return (files);
}


function getMainLayer(doc) {
    if(selectedMainLayer != null){
        return selectedMainLayer;
    }
    var layers = doc.layers;
    var mainLayer;
    /// check for the multiple layers 
    if (layers.length > 1) {
        var layerNames = [];

        for (var i = 0; i < layers.length; i++) {
            layerNames.push(layers[i].name);
        }

        // Create a dialog with a dropdown
        var dlg = new Window("dialog", "Select a Layer");
        dlg.add("statictext", undefined, "Choose a layer:");

        var dropdown = dlg.add("dropdownlist", undefined, layerNames);
        dropdown.selection = 0; // Default selection

        var okButton = dlg.add("button", undefined, "OK");
        okButton.onClick = function () {
            dlg.close();
        };

        dlg.show();

        var selectedLayerName = dropdown.selection.text;

        try {
            mainLayer = layers.getByName(selectedLayerName);
        } catch (e) {
            alert("Layer '" + selectedLayerName + "' not found!");
            return;
        }
    } else {
        // If only one layer, select it automatically
        mainLayer = layers[0];
    }
    selectedMainLayer = mainLayer;
    return mainLayer;

}

function MainLayerObjectLength(mainLayer) {
    var objects = [];
    findObjects(mainLayer, objects);
    return [objects.length, mainLayer.name];
}

function getObjectCount(doc) {
    return MainLayerObjectLength(getMainLayer(doc))
}


// Function to mark that barcodes have been generated
function markBarcodesGenerated(layer) {
    var markerLayer = layer.layers.add();
    markerLayer.name = barcodeKey;
}

function checkForBarcode() {
    var doc = app.activeDocument;
    // Check all layers in the document recursively
    for (var i = 0; i < doc.layers.length; i++) {
        if (checkBarcodeInLayers(doc.layers[i])) {
            return true;
        }
    }
    return false;
}

function checkBarcodeInLayers(layer) {
    // First check if this layer itself has the barcode key in its name
    if (layer.name.indexOf(barcodeKey) !== -1) {
        return true;
    }
    
    // Then check all sublayers recursively
    for (var i = 0; i < layer.layers.length; i++) {
        if (checkBarcodeInLayers(layer.layers[i])) {
            return true;
        }
    }
    
    // Finally check all page items in this layer
    for (var j = 0; j < layer.pageItems.length; j++) {
        var item = layer.pageItems[j];
        if (item.userData && item.userData.barcode) {
            return true;
        }
    }
    
    return false;
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

//  ====================================================BARCODE==================================================================================================================
// Barcode
function generateEAN13Barcode(ean, x, y, width, height, textPadding, barcodeLayer) {
    var doc = app.activeDocument;
    var fontName = "OCRBStd";

    // Error handling for invalid EAN-13
    if (!ean.match(/^\d{13}$/)) {
        alert("Invalid EAN-13 number. It must be exactly 13 digits.");
        return;
    }

    // Calculate the correct checksum
    var correctChecksum = CheckDigit(ean);
    if (correctChecksum != ean[12]) {
        // alert("The barcode " + ean + " does not have the right checksum. The checksum digit must be " + correctChecksum);
        throw Error("The barcode " + ean + " does not have the right checksum. The checksum digit must be " + correctChecksum);
        // ean = ean.substring(0, 12) + correctChecksum; // Update the barcode with the correct checksum
        // alert("The barcode has been corrected to: " + ean);
    }

    // Error handling for font availability
    if (!fontAvailable(fontName)) {
        // alert("The font " + fontName + " is not available. Please install it and try again.");
        return;
    }

    // Create the barcode group within the specified layer
    var EANGroup = barcodeLayer.groupItems.add();
    var barColor = make_cmyk(0, 0, 0, 100); // Black color

    // Adjust width for correct fit
    var block = width * 0.00346;
    var blockHeightExtra = height * 1.07; // Height of barcode
    var fontSize = block * 6; // Font size

    var zX = x;
    var zY = y;
    var gapD = block * 7;

    // Create a white background rectangle
    var whiteRect = EANGroup.pathItems.rectangle(zY, zX - block * 10, block * 118, blockHeightExtra * 1.16);
    whiteRect.stroked = false;
    whiteRect.filled = true;
    whiteRect.fillColor = make_cmyk(0, 0, 0, 0); // White color

    // Create the barcode
    var bcRenderObject = new bcRenderChar(zX, zY, block, blockHeightExtra, barColor, EANGroup, gapD);
    bcRenderObject.draw("sep");
    bcRenderObject.x += block * 4;
    bcRenderObject.h = height;
    bcRenderObject.drawLeft(ean.substring(0, 7));
    bcRenderObject.draw("sep");
    bcRenderObject.x += block * 5;
    bcRenderObject.h = height;

    for (var j = 7; j < 12; j++) {
        bcRenderObject.draw(ean[j]);
        bcRenderObject.x += gapD;
    }
    bcRenderObject.draw(ean[12]);
    bcRenderObject.x += block * 3;
    bcRenderObject.h = blockHeightExtra;
    bcRenderObject.draw("sep");

    // Add the EAN-13 text below the barcode
    var topPos = y - height * 1.03 - textPadding;
    // pointText(EANGroup, fontSize, ean.charAt(0), topPos, x + block - block * 4, fontName, 1);
    // pointText(EANGroup, fontSize, ean.substring(1, 7), topPos, x + block + block * 2, fontName, 1);
    pointText(EANGroup, fontSize, ean, topPos, x + (block + block) , fontName, 1);

    return EANGroup;
}

// Helper functions
// Barcode
function fontAvailable(myName) {
    try {
        var myFont = textFonts.getByName(myName);
        return true;
    } catch (e) {
        return false;
    }
}
// Barcode
function make_cmyk(c, m, y, k) {
    var colorRef = new CMYKColor();
    colorRef.cyan = c;
    colorRef.magenta = m;
    colorRef.yellow = y;
    colorRef.black = k;
    return colorRef;
}
// Barcode
function CheckDigit(myCode) {
    var mySum = 0;
    for (var j = 0; j < myCode.length - 1; j = j + 1) {
        var weight = (j % 2 == 0) ? 1 : 3;
        var myNumber = myCode[j] * weight;
        mySum += myNumber;
    }
    var checkDigit = Math.ceil(mySum / 10) * 10 - mySum;
    return checkDigit;
}
// Barcode
function pointText(Group, fontSize, charNr, topPos, leftPos, fontName, fontScale) {
    var pointTextRef = Group.textFrames.add();
    pointTextRef.textRange.size = fontSize;
    pointTextRef.contents = charNr;
    pointTextRef.position = [leftPos, topPos];
    pointTextRef.textRange.characterAttributes.textFont = textFonts.getByName(fontName);
    pointTextRef.textRange.characterAttributes.size = pointTextRef.textRange.characterAttributes.size * fontScale;
    return pointTextRef;
}
// Barcode
// Barcode rendering class
function bcRenderChar(x, y, w, h, col, gr, gapD) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.col = col;
    this.gr = gr;
    this.gapD = gapD;

    this.L = {
        "0": [3, 2, 6, 1],
        "1": [2, 2, 6, 1],
        "2": [2, 1, 5, 2],
        "3": [1, 4, 6, 1],
        "4": [1, 1, 5, 2],
        "5": [1, 2, 6, 1],
        "6": [1, 1, 3, 4],
        "7": [1, 3, 5, 2],
        "8": [1, 2, 4, 3],
        "9": [3, 1, 5, 2]
    };

    this.G = {
        "0": [1, 1, 4, 3],
        "1": [1, 2, 5, 2],
        "2": [2, 2, 5, 2],
        "3": [1, 1, 6, 1],
        "4": [2, 3, 6, 1],
        "5": [1, 3, 6, 1],
        "6": [4, 1, 6, 1],
        "7": [2, 1, 6, 1],
        "8": [3, 1, 6, 1],
        "9": [2, 1, 4, 3]
    };

    this.dictL = {
        "0": "LLLLLL",
        "1": "LLGLGG",
        "2": "LLGGLG",
        "3": "LLGGGL",
        "4": "LGLLGG",
        "5": "LGGLLG",
        "6": "LGGGLL",
        "7": "LGLGLG",
        "8": "LGLGGL",
        "9": "LGGLGL"
    };

    this.dictR = {
        "sep": [1, 1, 3, 1],
        "0": [0, 3, 5, 1],
        "1": [0, 2, 4, 2],
        "2": [0, 2, 3, 2],
        "3": [0, 1, 5, 1],
        "4": [0, 1, 2, 3],
        "5": [0, 1, 3, 3],
        "6": [0, 1, 2, 1],
        "7": [0, 1, 4, 1],
        "8": [0, 1, 3, 1],
        "9": [0, 3, 4, 1]
    };

    this.drawLeft = function (content) {
        var mySeq = this.dictL[content[0]];
        for (var i = 1; i < content.length; i++) {
            var myLG = mySeq[i - 1];
            var parameters = (myLG == "L") ? this.L[content[i]] : this.G[content[i]];
            rect = this.gr.pathItems.rectangle(this.y, this.x + this.w * parameters[0], this.w * parameters[1], this.h);
            rect.stroked = false;
            rect.filled = true;
            rect.fillColor = this.col;
            rect = this.gr.pathItems.rectangle(this.y, this.x + this.w * parameters[2], this.w * parameters[3], this.h);
            rect.stroked = false;
            rect.filled = true;
            rect.fillColor = this.col;
            this.x += this.gapD;
        }
    };

    this.draw = function (textChar) {
        var parameters = this.dictR[textChar];
        rect = this.gr.pathItems.rectangle(this.y, this.x + this.w * parameters[0], this.w * parameters[1], this.h);
        rect.stroked = false;
        rect.filled = true;
        rect.fillColor = this.col;
        rect = this.gr.pathItems.rectangle(this.y, this.x + this.w * parameters[2], this.w * parameters[3], this.h);
        rect.stroked = false;
        rect.filled = true;
        rect.fillColor = this.col;
    };
}

// End Barcode


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


function getDocName() {
    selectedMainLayer = null;
    if (!app.documents.length) {
        return "error: No active document found";
    }

    var doc = app.activeDocument;
    var data = getObjectCount(doc);
        // Check if barcodes have already been generated
        if (checkForBarcode()) {
            alert("Barcodes already generated! Delete all barcode Layers to regenerate.");
            return "error";
        }
    /// data contains layerLength and the selected layer name 
    return [doc.name, data[0], data[1]]; // Returning an array
}

/// login user account

function userLogin() {
    var session_token = readToken();
    if(session_token != null){
        // alert("No Need to login session token already exits : " + session_token);
        return  session_token;
        
    }
    else{
        alert("Error: Please Login to the desktop application")
        return;
    }
    var dialog = new Window("dialog", "User Login");

    dialog.orientation = "column";
    dialog.alignChildren = "fill";

    // Username Field
    dialog.add("statictext", undefined, "Enter your username:");
    var usernameInput = dialog.add("edittext", undefined, "");
    usernameInput.characters = 20;

    // Password Field (Hidden)
    dialog.add("statictext", undefined, "Enter your password:");
    var passwordInput = dialog.add("edittext", undefined, "");
    passwordInput.characters = 20;
    passwordInput.password = true; // Makes input hidden

    // Buttons
    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = "center";

    var okButton = buttonGroup.add("button", undefined, "OK", { name: "ok" });
    var cancelButton = buttonGroup.add("button", undefined, "Cancel", { name: "cancel" });

    var userData = null;

    // Handle button clicks
    okButton.onClick = function () {
        userData = {
            username: usernameInput.text,
            password: passwordInput.text
        };
        dialog.close();
    };

    cancelButton.onClick = function () {
        userData = null;
        dialog.close();
    };

    dialog.show();
    // alert("login data sent to html") 
    // getSystemInfo();/// get device info
    return [userData.username, userData.password];

    //     // Usage Example:
    // var credentials = userLogin();
    // if (credentials) {
    //     alert("Username: " + credentials.username + "\nPassword: " + credentials.password);
    // } else {
    //     alert("Login Cancelled.");
    // }

}


/// storetoken
function storeToken(session_token) {
    var homeFolder = Folder.userData; // Get user's home directory
    var sessionFile = new File(homeFolder + "/.token"); // Hidden file

    if (sessionFile.open("w")) { // Open file in write mode
        sessionFile.write(session_token); // Store session token
        sessionFile.close();
        // alert("Token stored: to path: " + sessionFile.path);
    } else {
        // alert("Error: Unable to store session token.");
    }
}


//// delete token if get expired 
function deleteToken() {
    var homeFolder = Folder.userData; // Get user's home directory
    var sessionFile = new File(homeFolder + "/Desktop/.token.txt"); // Hidden file path

    if (sessionFile.exists) { // Check if file exists
        if (sessionFile.remove()) { // Delete the file
            // alert("Session token deleted successfully.");
        } else {
            // alert("Error: Unable to delete session token.");
        }
    } else {
        // alert("No session token found.");
    }
}


/// read token
function readToken() {
    var desktopFolder = Folder.desktop; // Correct way to access Desktop
    var sessionFile = new File(desktopFolder + "/.token.txt");

    if (sessionFile.exists) {
        if (sessionFile.open("r")) {
            var session_token = sessionFile.read();
            sessionFile.close();
            // alert(session_token);
            return session_token;
        } else {
            // alert("Error: Unable to read session token.");
            return null;
        }
    } else {
        // alert("Session token file does not exist.");
        return null;
    }
}



function replaceArrowWithBackslash(inputString) {
    return inputString.split(">").join("\\"); // Replace all > with \
}


function deleteFiles(fileData) {
    var fileString = replaceArrowWithBackslash(fileData);

    var files = fileString.split(","); // Split into individual file paths
    // alert(files);
    // alert(files.length);
    for (var i = 0; i < files.length; i++) {
        var filePathNew = files[i];
        // alert(filePathNew);
        deleteFile(filePathNew);
    }
    removeAllBarcodes();
}

function deleteFile(filePath) {
    var file = new File(filePath);

    if (file.exists) {
        file.remove();
    }

}

function removeAllBarcodes() {
    var doc = app.activeDocument;
    var mainLayer = getMainLayer(doc);
    if (!mainLayer) return;
    for (var i = 0; i < doc.layers.length; i++) {
        removeBarcodeLayers(doc.layers[i]);
    }
    
}

function removeBarcodeLayers(layer) {
    for (var i = layer.layers.length - 1; i >= 0; i--) {
        var subLayer = layer.layers[i];
        if (subLayer.name.indexOf(barcodeKey) !== -1) {
            subLayer.remove();
        } else {
            removeBarcodeLayers(subLayer); // Recursively check sublayers
        }
    }
}

// https://jog-desktop.jog-joinourgame.com/store_files.php
// {
//     "order_name": "TH24-1192 Geneva Cyclones - Hoodie HD AS.eps",
//     "file_paths": ["uploads/file1.eps", "uploads/file2.eps"],
//     "file_name": ["254245214512512.eps", "125452548547852.eps"]
// }
// {
//     "success": true,
//     "order_code": "TH24-1192",
//     "message": "Files stored successfully"
// }

/// get system info 
function getSystemInfo() {
    var deviceName = system.callSystem("scutil --get ComputerName"); // Get device name
    var serialNumber = system.callSystem("ioreg -l | awk '/IOPlatformSerialNumber/ {print $4}'"); // Get serial number

    serialNumber = serialNumber.replace(/"/g, "").trim(); // Clean output
    // alert("Device Name: " + deviceName + "\nSerial Number: " + serialNumber);
    return {
        deviceName: deviceName,
        serialNumber: serialNumber
    };
}
// Usage Example:
// var info = getDeviceInfo();
// alert("Device Name: " + info.deviceName + "\nSerial Number: " + info.serialNumber);

function generateEAN13BarcodeNew(ean, x, y, width, height, textPadding, barcodeLayer) {
try{    var data = getBarcodeData();
    var code = '0000000000'; // Initialize with quiet zone
    code += data['Start Code B']['bin']; // Add start code

    // Add text
    var checksum = data['Start Code B']['value'];
    for (var i = 0; i < ean.length; i++) {
        var check = ean[i];
        code += data[check]['bin'] || '';
        checksum += (i + 1) * (data[check]['value'] || 0);
    }

    // Calculate checksum
    checksum = checksum % 103;
    for (var d in data) {
        if (data[d]['value'] == checksum) {
            code += data[d]['bin'];
            break;
        }
    }

    code += data['Stop Pattern']['bin']; // Add stop pattern
    code += '0000000000'; // Add quiet zone

    // Draw barcode
    var barWidth = width / code.length;
    for (var i = 0; i < code.length; i++) {
        if (code[i] == '1') {
            var rect = barcodeLayer.pathItems.rectangle(y, x + i * barWidth, barWidth, height);
            rect.filled = true;
            rect.stroked = false;
            rect.fillColor = new RGBColor();
            rect.fillColor.black = 100;
        }
    }

    // Add text below barcode
    var text = barcodeLayer.textFrames.add();
    text.contents = ean;
    text.textRange.characterAttributes.size = textPadding;
    text.position = [x + width / 2, y - height - textPadding];
    text.textRange.paragraphs.justification = Justification.CENTER;
    // alert("Barcode generated : ");  
    }catch(e){
         alert("Barcode error : "  + e);
         throw Error(e);
    }
}

function getBarcodeData() {
    return {
        ' ': { value: 0, bin: '11011001100' },
        '!': { value: 1, bin: '11001101100' },
        '"': { value: 2, bin: '11001100110' },
        '#': { value: 3, bin: '10010011000' },
        '$': { value: 4, bin: '10010001100' },
        '%': { value: 5, bin: '10001001100' },
        '&': { value: 6, bin: '10011001000' },
        '\'': { value: 7, bin: '10011000100' },
        '(': { value: 8, bin: '10001100100' },
        ')': { value: 9, bin: '11001001000' },
        '*': { value: 10, bin: '11001000100' },
        '+': { value: 11, bin: '11000100100' },
        ',': { value: 12, bin: '10110011100' },
        '-': { value: 13, bin: '10011011100' },
        '.': { value: 14, bin: '10011001110' },
        '/': { value: 15, bin: '10111001100' },
        '0': { value: 16, bin: '10011101100' },
        '1': { value: 17, bin: '10011100110' },
        '2': { value: 18, bin: '11001110010' },
        '3': { value: 19, bin: '11001011100' },
        '4': { value: 20, bin: '11001001110' },
        '5': { value: 21, bin: '11011100100' },
        '6': { value: 22, bin: '11001110100' },
        '7': { value: 23, bin: '11101101110' },
        '8': { value: 24, bin: '11101001100' },
        '9': { value: 25, bin: '11100101100' },
        ':': { value: 26, bin: '11100100110' },
        ';': { value: 27, bin: '11101100100' },
        '<': { value: 28, bin: '11100110100' },
        '=': { value: 29, bin: '11100110010' },
        '>': { value: 30, bin: '11011011000' },
        '?': { value: 31, bin: '11011000110' },
        '@': { value: 32, bin: '11000110110' },
        'A': { value: 33, bin: '10100011000' },
        'B': { value: 34, bin: '10001011000' },
        'C': { value: 35, bin: '10001000110' },
        'D': { value: 36, bin: '10110001000' },
        'E': { value: 37, bin: '10001101000' },
        'F': { value: 38, bin: '10001100010' },
        'G': { value: 39, bin: '11010001000' },
        'H': { value: 40, bin: '11000101000' },
        'I': { value: 41, bin: '11000100010' },
        'J': { value: 42, bin: '10110111000' },
        'K': { value: 43, bin: '10110001110' },
        'L': { value: 44, bin: '10001101110' },
        'M': { value: 45, bin: '10111011000' },
        'N': { value: 46, bin: '10111000110' },
        'O': { value: 47, bin: '10001110110' },
        'P': { value: 48, bin: '11101110110' },
        'Q': { value: 49, bin: '11010001110' },
        'R': { value: 50, bin: '11000101110' },
        'S': { value: 51, bin: '11011101000' },
        'T': { value: 52, bin: '11011100010' },
        'U': { value: 53, bin: '11011101110' },
        'V': { value: 54, bin: '11101011000' },
        'W': { value: 55, bin: '11101000110' },
        'X': { value: 56, bin: '11100010110' },
        'Y': { value: 57, bin: '11101101000' },
        'Z': { value: 58, bin: '11101100010' },
        '[': { value: 59, bin: '11100011010' },
        '\\': { value: 60, bin: '11101111010' },
        ']': { value: 61, bin: '11001000010' },
        '^': { value: 62, bin: '11110001010' },
        '_': { value: 63, bin: '10100110000' },
        '`': { value: 64, bin: '10100001100' },
        'a': { value: 65, bin: '10010110000' },
        'b': { value: 66, bin: '10010000110' },
        'c': { value: 67, bin: '10000101100' },
        'd': { value: 68, bin: '10000100110' },
        'e': { value: 69, bin: '10110010000' },
        'f': { value: 70, bin: '10110000100' },
        'g': { value: 71, bin: '10011010000' },
        'h': { value: 72, bin: '10011000010' },
        'i': { value: 73, bin: '10000110100' },
        'j': { value: 74, bin: '10000110010' },
        'k': { value: 75, bin: '11000010010' },
        'l': { value: 76, bin: '11001010000' },
        'm': { value: 77, bin: '11110111010' },
        'n': { value: 78, bin: '11000010100' },
        'o': { value: 79, bin: '10001111010' },
        'p': { value: 80, bin: '10100111100' },
        'q': { value: 81, bin: '10010111100' },
        'r': { value: 82, bin: '10010011110' },
        's': { value: 83, bin: '10111100100' },
        't': { value: 84, bin: '10011110100' },
        'u': { value: 85, bin: '10011110010' },
        'v': { value: 86, bin: '11110100100' },
        'w': { value: 87, bin: '11110010100' },
        'x': { value: 88, bin: '11110010010' },
        'y': { value: 89, bin: '11011011110' },
        'z': { value: 90, bin: '11011110110' },
        '{': { value: 91, bin: '11110110110' },
        '|': { value: 92, bin: '10101111000' },
        '}': { value: 93, bin: '10100011110' },
        '~': { value: 94, bin: '10001011110' },
        'DEL': { value: 95, bin: '10111101000' },
        'FNC 3': { value: 96, bin: '10111100010' },
        'FNC 2': { value: 97, bin: '11110101000' },
        'Shift A': { value: 98, bin: '11110100010' },
        'Code C': { value: 99, bin: '10111011110' },
        'FNC 4': { value: 100, bin: '10111101110' },
        'Code A': { value: 101, bin: '11101011110' },
        'FNC 1': { value: 102, bin: '11110101110' },
        'Start Code A': { value: 103, bin: '11010000100' },
        'Start Code B': { value: 104, bin: '11010010000' },
        'Start Code C': { value: 105, bin: '11010011100' },
        'Stop': { value: 106, bin: '11000111010' },
        'Reverse Stop': { value: 0, bin: '11010111000' },
        'Stop Pattern': { value: 0, bin: '1100011101011' },
        'Silent Zone': { value: 0, bin: '0000000000' }
    };
}


function toPNG(doc) {
    // Create progress window
    var win = new Window('window', 'Exporting PNG', undefined, {closeable: false});
    win.orientation = 'column';
    win.alignChildren = 'center';
    win.margins = 20;
    
    // Title
    var title = win.add('statictext', undefined, '🖌️ Exporting PNG');
    title.graphics.font = ScriptUI.newFont("Helvetica", "BOLD", 16);
    
    // Progress bar group
    var progressGroup = win.add('group');
    progressGroup.orientation = 'row';
    progressGroup.alignChildren = 'center';
    progressGroup.spacing = 10;
    
    // Correct progressbar implementation
    var progressBar = progressGroup.add('progressbar', undefined, 0, 100);
    progressBar.preferredSize = [250, 20];
    
    // Percentage text
    var percentText = progressGroup.add('statictext', undefined, '0%');
    percentText.graphics.font = ScriptUI.newFont("Helvetica", "BOLD", 14);
    
    // Status message
    var statusText = win.add('statictext', undefined, 'Starting export...');
    
    win.center();
    win.show();

    // File handling
    var fileName = doc.name.replace(/\.[^.]+$/, "").replace(/-\[Converted\]$/, "_img");
    var outputPath = doc.fullName && doc.fullName.parent ? doc.fullName.parent.fsName : Folder.desktop.fsName;
    var outputFile = new File(outputPath + "/" + fileName + ".png");

    // Update progress function
    function updateProgress(percent, message) {
        progressBar.value = percent;
        percentText.text = percent + '%';
        statusText.text = message;
        win.update();
    }

    try {
        // Simulate preparation (0-30%)
        for (var i = 0; i <= 30; i++) {
            updateProgress(i, 'Preparing document...');
            $.sleep(20);
        }

        // Actual export (30-70%)
        var exportOptions = new ExportOptionsPNG24();
        exportOptions.antiAliasing = true;
        exportOptions.transparency = true;
        doc.exportFile(outputFile, ExportType.PNG24, exportOptions);
        
        for (var i = 31; i <= 70; i++) {
            updateProgress(i, 'Exporting image data...');
            $.sleep(10);
        }

        // Finalizing (70-100%)
        waitForFile(outputFile);
        for (var i = 71; i <= 100; i++) {
            updateProgress(i, 'Finalizing export...');
            $.sleep(5);
        }

        // Completion
        updateProgress(100, '✅ Export completed!');
        $.sleep(1000);
        
    } catch (e) {
        updateProgress(100, '❌ Error: ' + e.message);
        $.sleep(2000);
    }
    
    win.close();
}

function waitForFile(file) {
    var startTime = new Date().getTime();
    while ((new Date().getTime() - startTime) < 3000) {
        if (file.exists && file.length > 0) return true;
        $.sleep(200);
    }
    return false;
}




//==========================================OR CODE DATA=======================================
/*!
 * Illustrator QR Code Generator
 * Creates vector QR codes in Adobe Illustrator with minimal paths
 * Includes generateQRCode function for easy integration
 */
 // Scannable QR Code Generation (using the working implementation you provided)
// Main function to generate QR Code
function generateQRCode(text, x, y, width, height, textPadding, qrLayerFrame) {
	var win = new Window('window', 'QR', undefined, {closeable: false});
	// Title
    var title = win.add('statictext', undefined, '🖌️ Generating QR please Wait...');
	 // Progress bar group
    var progressGroup = win.add('group');
    progressGroup.orientation = 'row';
    progressGroup.alignChildren = 'center';
    progressGroup.spacing = 10;
	// Correct progressbar implementation
    var progressBar = progressGroup.add('progressbar', undefined, 0, 100);
    progressBar.preferredSize = [250, 20];
    
    // Percentage text
    var percentText = progressGroup.add('statictext', undefined, '0%');
    percentText.graphics.font = ScriptUI.newFont("Helvetica", "BOLD", 14);
    
    // Status message
    var statusText = win.add('statictext', undefined, 'Starting Genration...');
    
    win.center();
    try {
		win.show();
		progressBar.value = 100;
        percentText.text = 100 + '%';
        statusText.text = "Generating QR please Wait...";
        win.update();
        // Create a new sublayer inside the specified QR layer frame
        var qrLayer = qrLayerFrame.layers.add();
        qrLayer.name = "QR-Code";

        // Create a group to hold all elements related to this QR code
        var QRGroup = qrLayer.groupItems.add();
        var barColor = make_cmyk(0, 0, 0, 100);

        // Calculate block size and font size for text
        var block = width * 0.015;
        var fontSize = block * 6;

        // Generate the QR code
        var qr = new QRCode(-1, QRErrorCorrectLevel.H);
        qr.addData(text);
        qr.make();

        // Calculate QR code module and full dimensions
        var qrSize = qr.modules.length;
        var moduleSize = Math.min(width, height) / qrSize;
        var qrWidth = qrSize * moduleSize;
        var qrHeight = qrSize * moduleSize;

        // Create the actual QR code using IllustratorQR helper
        var illQR = new IllustratorQR();
        illQR.init(qr.modules, app.activeDocument, qrLayer);
        illQR.make(moduleSize, x - qrWidth / 2, y + qrHeight / 2, QRGroup);

        // === CORE Code ===

        // Create white background rectangle aligned to x,y in the main frame layer
        var whiteRect = qrLayerFrame.pathItems.rectangle(
            y + qrHeight / 2 - 50,  // Top
            x - qrWidth / 2,   // Left
            qrWidth,
            qrHeight
        );
        whiteRect.stroked = false;
        whiteRect.filled = true;
        whiteRect.fillColor = make_cmyk(0, 0, 0, 0); // White
        whiteRect.zOrder(ZOrderMethod.SENDTOBACK);

        // Add text below the QR code, centered horizontally
        var textItem = qrLayerFrame.textFrames.add();
        textItem.contents = text;
        textItem.textRange.characterAttributes.size = fontSize;
        textItem.textRange.paragraphs.justification = Justification.CENTER;
        textItem.position = [
            x - 70,  // Center horizontally
            y - qrHeight / 2 - textPadding - 50  // Below QR
        ];

        // === Align qrLayer to whiteRect ===

        var whiteBounds = whiteRect.visibleBounds; // [left, top, right, bottom]
        var targetLeft = whiteBounds[0];
        var targetTop = whiteBounds[1];

        // Get bounds of the qrLayer content
        var bounds = qrLayer.pageItems[0].visibleBounds.slice();
        for (var i = 1; i < qrLayer.pageItems.length; i++) {
            var b = qrLayer.pageItems[i].visibleBounds;
            bounds[0] = Math.min(bounds[0], b[0]); // left
            bounds[1] = Math.max(bounds[1], b[1]); // top
        }

        var currentLeft = bounds[0];
        var currentTop = bounds[1];

        // Calculate offset
        var dx = targetLeft - currentLeft;
        var dy = targetTop - currentTop;

        // Move all qrLayer items by offset
        for (var i = 0; i < qrLayer.pageItems.length; i++) {
            var item = qrLayer.pageItems[i];
            item.position = [item.position[0] + dx, item.position[1] + dy];
        }

        return qrLayerFrame;

    } catch (e) {
        alert("QR Code error: " + e);
        throw Error(e);
		win.hide();
    }
	
}



/*
/// MOVE
// Assuming you have the EPS file loaded in your document and the target layer is "MyLayer"
var docSelected = app.activeDocument.selection; // Get the selected items
var targetLayer = app.activeDocument.layers["MyLayer"]; // Get the target layer

for (s = 0; s < docSelected.length; s++) {
  var myPath = docSelected[s]; // Iterate through the selected items
  myPath.move(targetLayer, ElementPlacement.PLACEATBEGINNING); // Move the selected items to the target layer
}

/// chanage Pos
win.btnGroup.okBtn.onClick = function() {
	qrData = win.dataGroup.qrData.text;
	qrSize = parseInt(win.sizeGroup.qrSize.text) * 72;
	var xAxis = parseFloat(win.positionGroup.xPos.text);
	var yAxis = parseFloat(win.positionGroup.yPos.text);
	var xPos = (parseFloat(win.positionGroup.xPos.text) ) * 72; // Convert inches to points
	var yPos = (parseFloat(win.positionGroup.yPos.text)) * 72; // Convert inches to points

	if (qrData !== '') {
		win.close();

		try {
			var doc = app.activeDocument;
			
			// Create or get QR Codes layer
			var qrLayer;
			try {
				qrLayer = doc.layers.getByName("QR Codes");
			} catch(e) {
				qrLayer = doc.layers.add();
				qrLayer.name = "QR Codes";
			}

			// Make sure layer is active and ready
			qrLayer.visible = true;
			qrLayer.locked = false;

			// Generate QR Code
			qr.addData(qrData);
			qr.make();

			// Initialize QR with position
			IllQR.init(qr.modules, doc);
			IllQR.make(qrSize / qr.modules.length);

			// Create a group for the new QR code items
			var group = qrLayer.groupItems.add();
			
			// Only move items that were just created and are in the default layer
			var defaultLayer = doc.layers[0];
			var items = defaultLayer.pathItems;
			while (items.length > 0) {
				items[0].move(group, ElementPlacement.PLACEATEND);
			}
			
			// Calculate the offset based on the QR code size
			var moduleSize = qrSize / qr.modules.length;
			var qrOffset = moduleSize / 2;
			// alert('off set is  ' + qrOffset + " Xpos " + qrLayer.xAxis + " Ypos " + qrLayer.yAxis);
			// // Move the group to the specified position with offset compensation
			// group.left = xPos - qrOffset; // Compensate for the observed x offset
			// group.top = doc.height - yPos + qrOffset; // Compensate for the observed y offset
			// qrLayer.move(0,0); 
			 // Get the current bounds of the layer's content
    var bounds = qrLayer.pageItems[0].visibleBounds.slice();

    for (var i = 1; i < qrLayer.pageItems.length; i++) {
        var b = qrLayer.pageItems[i].visibleBounds;
        bounds[0] = Math.min(bounds[0], b[0]); // Left (X)
        bounds[1] = Math.max(bounds[1], b[1]); // Top (Y)
    }

    var dx = 0 - bounds[0];
    var dy = 0 - bounds[1];

    // Move all items by that delta
    for (var i = 0; i < qrLayer.pageItems.length; i++) {
        var item = qrLayer.pageItems[i];
        item.position = [item.position[0] + dx, item.position[1] + dy];
    }

		} catch(e) {
			alert('Error generating QR code: ' + e + '\nLine: ' + e.line);
		}
	} else {
		alert('You must fill in the "QR Data" field.');
	}
}
*/
/*!
 * Illustrator QR v1.0
 * -------------------------------------------------------------------
 * An Adobe Illustrator script to create a vector QR Code. This script
 * strives to create a little paths and points as possible.
 *
 * This script wraps the qrcode library which can be found here:
 * http://www.d-project.com/qrcode/index.html
 *
 * Author: David Street
 * Created: September 2012
 *
 * Licensed under the MIT license.
 *
 * ENJOY!
 */




//////////////////////////////////////////////
//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

//---------------------------------------------------------------------
// QR8bitByte
//---------------------------------------------------------------------

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function(buffer) {
		return this.data.length;
	},

	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

//---------------------------------------------------------------------
// QRCode
//---------------------------------------------------------------------
function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = new Array();
}

QRCode.prototype = {

	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},

	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},

	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var i = 0; i < this.dataList.length; i++) {
					var data = this.dataList[i];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},

	makeImpl : function(test, maskPattern) {

		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);

		for (var row = 0; row < this.moduleCount; row++) {

			this.modules[row] = new Array(this.moduleCount);

			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}

		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);

		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}

		if (this.dataCache == null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}

		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {

		for (var r = -1; r <= 7; r++) {

			if (row + r <= -1 || this.moduleCount <= row + r) continue;

			for (var c = -1; c <= 7; c++) {

				if (col + c <= -1 || this.moduleCount <= col + c) continue;

				if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
						|| (0 <= c && c <= 6 && (r == 0 || r == 6) )
						|| (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}
		}
	},

	getBestMaskPattern : function() {

		var minLostPoint = 0;
		var pattern = 0;

		for (var i = 0; i < 8; i++) {

			this.makeImpl(true, i);

			var lostPoint = QRUtil.getLostPoint(this);

			if (i == 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}

		return pattern;
	},

	createMovieClip : function(target_mc, instance_name, depth) {

		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;

		this.make();

		for (var row = 0; row < this.modules.length; row++) {

			var y = row * cs;

			for (var col = 0; col < this.modules[row].length; col++) {

				var x = col * cs;
				var dark = this.modules[row][col];

				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}

		return qr_mc;
	},

	setupTimingPattern : function() {

		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] != null) {
				continue;
			}
			this.modules[r][6] = (r % 2 == 0);
		}

		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] != null) {
				continue;
			}
			this.modules[6][c] = (c % 2 == 0);
		}
	},

	setupPositionAdjustPattern : function() {

		var pos = QRUtil.getPatternPosition(this.typeNumber);

		for (var i = 0; i < pos.length; i++) {

			for (var j = 0; j < pos.length; j++) {

				var row = pos[i];
				var col = pos[j];

				if (this.modules[row][col] != null) {
					continue;
				}

				for (var r = -2; r <= 2; r++) {

					for (var c = -2; c <= 2; c++) {

						if (r == -2 || r == 2 || c == -2 || c == 2
								|| (r == 0 && c == 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},

	setupTypeNumber : function(test) {

		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);

		for (var i = 0; i < 18; i++) {
			var mod = (!test && ( (bits >> i) & 1) == 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}

		for (var i = 0; i < 18; i++) {
			var mod = (!test && ( (bits >> i) & 1) == 1);
			this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
		}
	},

	setupTypeInfo : function(test, maskPattern) {

		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);

		// vertical
		for (var i = 0; i < 15; i++) {

			var mod = (!test && ( (bits >> i) & 1) == 1);

			if (i < 6) {
				this.modules[i][8] = mod;
			} else if (i < 8) {
				this.modules[i + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + i][8] = mod;
			}
		}

		// horizontal
		for (var i = 0; i < 15; i++) {

			var mod = (!test && ( (bits >> i) & 1) == 1);

			if (i < 8) {
				this.modules[8][this.moduleCount - i - 1] = mod;
			} else if (i < 9) {
				this.modules[8][15 - i - 1 + 1] = mod;
			} else {
				this.modules[8][15 - i - 1] = mod;
			}
		}

		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);

	},

	mapData : function(data, maskPattern) {

		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;

		for (var col = this.moduleCount - 1; col > 0; col -= 2) {

			if (col == 6) col--;

			while (true) {

				for (var c = 0; c < 2; c++) {

					if (this.modules[row][col - c] == null) {

						var dark = false;

						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
						}

						var mask = QRUtil.getMask(maskPattern, row, col - c);

						if (mask) {
							dark = !dark;
						}

						this.modules[row][col - c] = dark;
						bitIndex--;

						if (bitIndex == -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}

				row += inc;

				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}

	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {

	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);

	var buffer = new QRBitBuffer();

	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var i = 0; i < rsBlocks.length; i++) {
		totalDataCount += rsBlocks[i].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. ("
			+ buffer.getLengthInBits()
			+ ">"
			+  totalDataCount * 8
			+ ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 != 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {

		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);

		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
}

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;

	var maxDcCount = 0;
	var maxEcCount = 0;

	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);

	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);

		dcdata[r] = new Array(dcCount);

		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;

		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var i = 0; i < ecdata[r].length; i++) {
            var modIndex = i + modPoly.getLength() - ecdata[r].length;
			ecdata[r][i] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}

	var totalCodeCount = 0;
	for (var i = 0; i < rsBlocks.length; i++) {
		totalCodeCount += rsBlocks[i].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var i = 0; i < maxDcCount; i++) {
		for (var r = 0; r < rsBlocks.length; r++) {
			if (i < dcdata[r].length) {
				data[index++] = dcdata[r][i];
			}
		}
	}

	for (var i = 0; i < maxEcCount; i++) {
		for (var r = 0; r < rsBlocks.length; r++) {
			if (i < ecdata[r].length) {
				data[index++] = ecdata[r][i];
			}
		}
	}

	return data;

}

//---------------------------------------------------------------------
// QRMode
//---------------------------------------------------------------------

var QRMode = {
	MODE_NUMBER :		1 << 0,
	MODE_ALPHA_NUM : 	1 << 1,
	MODE_8BIT_BYTE : 	1 << 2,
	MODE_KANJI :		1 << 3
};

//---------------------------------------------------------------------
// QRErrorCorrectLevel
//---------------------------------------------------------------------

var QRErrorCorrectLevel = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};

//---------------------------------------------------------------------
// QRMaskPattern
//---------------------------------------------------------------------

var QRMaskPattern = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

//---------------------------------------------------------------------
// QRUtil
//---------------------------------------------------------------------

var QRUtil = {

    PATTERN_POSITION_TABLE : [
	    [],
	    [6, 18],
	    [6, 22],
	    [6, 26],
	    [6, 30],
	    [6, 34],
	    [6, 22, 38],
	    [6, 24, 42],
	    [6, 26, 46],
	    [6, 28, 50],
	    [6, 30, 54],
	    [6, 32, 58],
	    [6, 34, 62],
	    [6, 26, 46, 66],
	    [6, 26, 48, 70],
	    [6, 26, 50, 74],
	    [6, 30, 54, 78],
	    [6, 30, 56, 82],
	    [6, 30, 58, 86],
	    [6, 34, 62, 90],
	    [6, 28, 50, 72, 94],
	    [6, 26, 50, 74, 98],
	    [6, 30, 54, 78, 102],
	    [6, 28, 54, 80, 106],
	    [6, 32, 58, 84, 110],
	    [6, 30, 58, 86, 114],
	    [6, 34, 62, 90, 118],
	    [6, 26, 50, 74, 98, 122],
	    [6, 30, 54, 78, 102, 126],
	    [6, 26, 52, 78, 104, 130],
	    [6, 30, 56, 82, 108, 134],
	    [6, 34, 60, 86, 112, 138],
	    [6, 30, 58, 86, 114, 142],
	    [6, 34, 62, 90, 118, 146],
	    [6, 30, 54, 78, 102, 126, 150],
	    [6, 24, 50, 76, 102, 128, 154],
	    [6, 28, 54, 80, 106, 132, 158],
	    [6, 32, 58, 84, 110, 136, 162],
	    [6, 26, 54, 82, 110, 138, 166],
	    [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)	| (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
	    var d = data << 10;
	    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
		    d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );
	    }
	    return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
	    var d = data << 12;
	    while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
		    d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );
	    }
	    return (data << 12) | d;
    },

    getBCHDigit : function(data) {

	    var digit = 0;

	    while (data != 0) {
		    digit++;
		    data >>>= 1;
	    }

	    return digit;
    },

    getPatternPosition : function(typeNumber) {
	    return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {

	    switch (maskPattern) {

	    case QRMaskPattern.PATTERN000 : return (i + j) % 2 == 0;
	    case QRMaskPattern.PATTERN001 : return i % 2 == 0;
	    case QRMaskPattern.PATTERN010 : return j % 3 == 0;
	    case QRMaskPattern.PATTERN011 : return (i + j) % 3 == 0;
	    case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0;
	    case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 == 0;
	    case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 == 0;
	    case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 == 0;

	    default :
		    throw new Error("bad maskPattern:" + maskPattern);
	    }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

	    var a = new QRPolynomial([1], 0);

	    for (var i = 0; i < errorCorrectLength; i++) {
		    a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
	    }

	    return a;
    },

    getLengthInBits : function(mode, type) {

	    if (1 <= type && type < 10) {

		    // 1 - 9

		    switch(mode) {
		    case QRMode.MODE_NUMBER 	: return 10;
		    case QRMode.MODE_ALPHA_NUM 	: return 9;
		    case QRMode.MODE_8BIT_BYTE	: return 8;
		    case QRMode.MODE_KANJI  	: return 8;
		    default :
			    throw new Error("mode:" + mode);
		    }

	    } else if (type < 27) {

		    // 10 - 26

		    switch(mode) {
		    case QRMode.MODE_NUMBER 	: return 12;
		    case QRMode.MODE_ALPHA_NUM 	: return 11;
		    case QRMode.MODE_8BIT_BYTE	: return 16;
		    case QRMode.MODE_KANJI  	: return 10;
		    default :
			    throw new Error("mode:" + mode);
		    }

	    } else if (type < 41) {

		    // 27 - 40

		    switch(mode) {
		    case QRMode.MODE_NUMBER 	: return 14;
		    case QRMode.MODE_ALPHA_NUM	: return 13;
		    case QRMode.MODE_8BIT_BYTE	: return 16;
		    case QRMode.MODE_KANJI  	: return 12;
		    default :
			    throw new Error("mode:" + mode);
		    }

	    } else {
		    throw new Error("type:" + type);
	    }
    },

    getLostPoint : function(qrCode) {

	    var moduleCount = qrCode.getModuleCount();

	    var lostPoint = 0;

	    // LEVEL1

	    for (var row = 0; row < moduleCount; row++) {

		    for (var col = 0; col < moduleCount; col++) {

			    var sameCount = 0;
			    var dark = qrCode.isDark(row, col);

				for (var r = -1; r <= 1; r++) {

				    if (row + r < 0 || moduleCount <= row + r) {
					    continue;
				    }

				    for (var c = -1; c <= 1; c++) {

					    if (col + c < 0 || moduleCount <= col + c) {
						    continue;
					    }

					    if (r == 0 && c == 0) {
						    continue;
					    }

					    if (dark == qrCode.isDark(row + r, col + c) ) {
						    sameCount++;
					    }
				    }
			    }

			    if (sameCount > 5) {
				    lostPoint += (3 + sameCount - 5);
			    }
		    }
	    }

	    // LEVEL2

	    for (var row = 0; row < moduleCount - 1; row++) {
		    for (var col = 0; col < moduleCount - 1; col++) {
			    var count = 0;
			    if (qrCode.isDark(row,     col    ) ) count++;
			    if (qrCode.isDark(row + 1, col    ) ) count++;
			    if (qrCode.isDark(row,     col + 1) ) count++;
			    if (qrCode.isDark(row + 1, col + 1) ) count++;
			    if (count == 0 || count == 4) {
				    lostPoint += 3;
			    }
		    }
	    }

	    // LEVEL3

	    for (var row = 0; row < moduleCount; row++) {
		    for (var col = 0; col < moduleCount - 6; col++) {
			    if (qrCode.isDark(row, col)
					    && !qrCode.isDark(row, col + 1)
					    &&  qrCode.isDark(row, col + 2)
					    &&  qrCode.isDark(row, col + 3)
					    &&  qrCode.isDark(row, col + 4)
					    && !qrCode.isDark(row, col + 5)
					    &&  qrCode.isDark(row, col + 6) ) {
				    lostPoint += 40;
			    }
		    }
	    }

	    for (var col = 0; col < moduleCount; col++) {
		    for (var row = 0; row < moduleCount - 6; row++) {
			    if (qrCode.isDark(row, col)
					    && !qrCode.isDark(row + 1, col)
					    &&  qrCode.isDark(row + 2, col)
					    &&  qrCode.isDark(row + 3, col)
					    &&  qrCode.isDark(row + 4, col)
					    && !qrCode.isDark(row + 5, col)
					    &&  qrCode.isDark(row + 6, col) ) {
				    lostPoint += 40;
			    }
		    }
	    }

	    // LEVEL4

	    var darkCount = 0;

	    for (var col = 0; col < moduleCount; col++) {
		    for (var row = 0; row < moduleCount; row++) {
			    if (qrCode.isDark(row, col) ) {
				    darkCount++;
			    }
		    }
	    }

	    var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
	    lostPoint += ratio * 10;

	    return lostPoint;
    }

};


//---------------------------------------------------------------------
// QRMath
//---------------------------------------------------------------------

var QRMath = {

	glog : function(n) {

		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}

		return QRMath.LOG_TABLE[n];
	},

	gexp : function(n) {

		while (n < 0) {
			n += 255;
		}

		while (n >= 256) {
			n -= 255;
		}

		return QRMath.EXP_TABLE[n];
	},

	EXP_TABLE : new Array(256),

	LOG_TABLE : new Array(256)

};

for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

//---------------------------------------------------------------------
// QRPolynomial
//---------------------------------------------------------------------

function QRPolynomial(num, shift) {

	if (num.length == undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;


	while (offset < num.length && num[offset] == 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},

	getLength : function() {
		return this.num.length;
	},

	multiply : function(e) {

		var num = new Array(this.getLength() + e.getLength() - 1);

		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}

		return new QRPolynomial(num, 0);
	},

	mod : function(e) {

		if (this.getLength() - e.getLength() < 0) {
			return this;
		}

		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );

		var num = new Array(this.getLength() );

		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}

		for (var i = 0; i < e.getLength(); i++) {
			num[i] ^= QRMath.gexp(QRMath.glog(e.get(i) ) + ratio);
		}

		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

//---------------------------------------------------------------------
// QRRSBlock
//---------------------------------------------------------------------

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],

	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],

	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],

	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],

	// 7
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],

	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],

	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],

	// 10
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {

	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);

	if (rsBlock == undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;

	var list = new Array();

	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );
		}
	}

	return list;
}

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
}

//---------------------------------------------------------------------
// QRBitBuffer
//---------------------------------------------------------------------

function QRBitBuffer() {
	this.buffer = new Array();
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},

	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},

	getLengthInBits : function() {
		return this.length;
	},

	putBit : function(bit) {

		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}

		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}

		this.length++;
	}
};

///////////////////////////////////
Array.prototype.isEqualTo = function(arr) {
	var key;

	if ( this.length !== arr.length ) {
		return false;
	}

	for ( key in this ) {
		if ( this[key] !== arr[key] ) {
			return false;
		}
	}

	return true;
}

Array.prototype.has = function(ele) {
	var i = 0
		, length = this.length;

	for ( i; i < length; i += 1 ) {

		if ( typeof(ele) === 'object' && typeof(this[i]) === 'object' ) {

			if ( this[i].isEqualTo(ele) ) {
				return true;
			}

		} else {

			if ( ele === this[i] ) {
				return true;
			}

		}

	}

	return false;
}


/*
 * IllustratorQR Class
 */

function getIllustratorPoints(points, size, offsetX, offsetY) {
    var illPoints = [];

    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        illPoints.push([
            offsetX + p[0] * size,
            offsetY - p[1] * size  // Illustrator Y-axis is flipped
        ]);
    }

    return illPoints;
}

var IllustratorQR = function() {

	var grid = []

		, gridRows = 0
		, gridCols = 0

		// Incremental variables used for looping through the grid's rows
		// and columns.
		, r = 0
		, c = 0

		// Map barrier positions to their coresponding move functions.
		, directionMap = [moveRight, moveDown, moveLeft, moveUp]

		// Array of all completed polygons.
		// Element prototype: { color: 0, points: [[0, 0]] }
		, polygons = []

		// Temporary polygon
		, newPoly = {}

		// The current point
		, lineCursor = []

		, prevDirection = 0

		// The block color we are currently working with.
		, currentColor = 0

		// Illustrator Document
		, illDocument;


	this.init = function(_modules, _illDoc, _layer) {  
		// Add _layer parameter
        var r = 0, c = 0;
        var rowLength = _modules.length;
        var colLength = _modules[0].length;

        // Reverse colors
        for (r = 0; r < rowLength; r += 1) {
            for (c = 0; c < colLength; c += 1) {
                _modules[r][c] = ~~_modules[r][c];
            }
        }

        grid = _modules;
        gridRows = rowLength;
        gridCols = colLength;
        illDocument = _illDoc;
        illLayer = _layer || _illDoc.layers[0]; 
		// Use provided layer or default
    };


this.make = function(size, offsetX, offsetY) {
    for (r; r < gridRows; r += 1) {
        currentColor = grid[r][0];
        for (c; c < gridCols; c += 1) {
            if (grid[r][c] === currentColor) {
                if (!isCaptured([r, c], [r, c])) {
                    newPoly = {
                        color: currentColor,
                        points: []
                    };

                    setPoint([c, r], newPoly);
                    prevDirection = 0;
                    setPoint([c + 1, r], newPoly);

                    while (!lineCursor.isEqualTo(newPoly.points[0])) {
                        newPosition = getNextPosition(newPoly);
                        setPoint(newPosition, newPoly);
                    }

                    polygons.push(newPoly);

                    // 👉 Offset included here
                    drawPath(getIllustratorPoints(newPoly.points, size, offsetX, offsetY), newPoly.color, illDocument);
                }
                currentColor = ~~!currentColor;
            }
        }
        c = 0;
    }
};

	/*
	 * Grid Methods
	 */

	// Check if the block (given by row and column) is within the grid.
	function inGrid(r, c) {
		if ( (r > (gridRows - 1) || r < 0)
			|| (c > (gridCols - 1) || c < 0) ) {

			return false;
		}

		return true;
	}

	// Get the four vertices of the given block.
	function getVertices(block) {
		var i = 0
			, x = 0
			, y = 0
			, vertices = [];

		for ( var i = 0, x = 0, y = 0; i < 4; i += 1 ) {
			vertices.push( [block[1] + x, block[0] + y] );

			x = (i % 2 === 0) ? ~~!x : x;
			y = (i >= 1) ? 1 : 0;
		}

		return vertices;
	}

	// Check if a block has been captured by a polygon of the same color.
	function isCaptured(block, origBlock, direction) {
		var vertices = getVertices( block )
			, captured = false
			, v = 0
			, poly = 0
			, p = 0
			, c = block[1]
			, r = block[0]
			, direction = direction || 'left'
			, checkColor = grid[origBlock[0]][origBlock[1]];

		// If block is outside bounds, then it hasn't been captured.
		if ( c < 0 || r < 0 || c > (gridCols - 1) || r > (gridRows - 1) ) {
			return false;
		}

		// Can't be a block of the opposite color
		if ( (checkColor !== undefined) && (grid[r][c] !== checkColor) ) {
			if ( direction === 'left' ) {
				direction = 'right';
				vertices = getVertices( origBlock );
				c = origBlock[1];
				r = origBlock[0];
			} else {
				return false;
			}
		}

		// If two consecutive points in a polygon are vertices of the block,
		// then it is captured.
		for ( poly; poly < polygons.length; poly += 1 ) {

			if ( polygons[poly].color === currentColor ) {

				for ( p = 0; p < polygons[poly].points.length; p += 1 ) {
					if ( vertices.has(polygons[poly].points[p]) && vertices.has(polygons[poly].points[p+1]) ) {
						return true;
					}
				}

			}
		}

		if ( direction === 'left' ) {
			// Check block to the left.
			if ( isCaptured([r, c - 1], origBlock) ) {
				return true;
			}

			// Check block to the top.
			if ( isCaptured([r - 1, c], origBlock) ) {
				return true;
			}

		} else {
			// Check block to the right.
			if ( isCaptured([r, c + 1], origBlock, 'right') ) {
				return true;
			}

			// Check block to the bottom.
			if ( isCaptured([r + 1, c], origBlock, 'right') ) {
				return true;
			}
		}

		return false;
	}

	function isCheckerd(point) {

		if ( (point[1] > 0 && point[1] < (gridRows)) && (point[0] > 0 && point[0] < (gridCols)) ) {
			if ( (grid[point[1] - 1][point[0] - 1] === grid[point[1]][point[0]]) &&
				grid[point[1] - 1][point[0]] === grid[point[1]][point[0] - 1] &&
				grid[point[1]][point[0]] !== grid[point[1] - 1][point[0]] ) {

				return true;
			}
		}

		return false;
	}


	/*
	 * Polygon Methods
	 */

	// Set the line cursor to the given point and adds it to the polygon's
	// point array.
	function setPoint(point, polygon) {
		lineCursor = [point[0], point[1]];
		polygon.points.push( [point[0], point[1]] );
	}

	// Checks if the polygon has a given point.
	function hasPoint(polygon, point) {
		var p = 0;

		for ( p in polygon.points ) {
			if ( point.isEqualTo(polygon.points[p]) ) {
				return true;
			}
		}

		return false;
	}


	/*
	 * Directional Methods
	 */

	function moveRight(point) {

		// If we can't move right
		if ( !inGrid(point[1], point[0]) ||
			grid[point[1]][point[0]] === ~~!currentColor ) {

			return false;
		}



		return [point[0] + 1, point[1]];
	}

	function moveDown(point) {

		// If we can't move down
		if ( !inGrid(point[1], point[0] - 1) ||
			grid[point[1]][point[0] - 1] === ~~!currentColor ) {

			return false;
		}

		return [point[0], point[1] + 1];
	}

	function moveLeft(point) {

		// If we can't move left
		if ( !inGrid(point[1] - 1, point[0] - 1) ||
			grid[point[1] - 1][point[0] - 1] === ~~!currentColor ) {

			return false;
		}

		return [point[0] - 1, point[1]];
	}

	function moveUp(point) {

		// If we can't move up
		if ( !inGrid(point[1] - 1, point[0]) ||
			grid[point[1] - 1][point[0]] === ~~!currentColor ) {

			return false;
		}

		return [point[0], point[1] - 1];
	}

	// Get the next position by finding the nearest barrier, and moving
	// accordingly.
	function getNextPosition(polygon) {
		var neighbors = []
			, n = 0
			, directionResult = false;

		// Set the neighbors array. These are the blocks that share a
		// point with the line cursor.
		neighbors[0] = [lineCursor[0], lineCursor[1] - 1]; 		// Top
		neighbors[1] = [lineCursor[0], lineCursor[1]];			// Right
		neighbors[2] = [lineCursor[0]-1, lineCursor[1]];		// Bottom
		neighbors[3] = [lineCursor[0]-1, lineCursor[1]-1];		// Left

		if ( isCheckerd(lineCursor) ) {
			if ( prevDirection === 0 ) {
				prevDirection = 1;
				return directionMap[1](lineCursor);
			} else if ( prevDirection === 1 ) {
				prevDirection = 2;
				return directionMap[2](lineCursor);
			} else if ( prevDirection === 2 ) {
				prevDirection = 3;
				return directionMap[3](lineCursor);
			} else if ( prevDirection === 3 ) {
				prevDirection = 0;
				return directionMap[0](lineCursor);
			}
		}

		for ( n; n < 4; n += 1 ) {
			// Neighbor is outside grid row bounds.
			if ( (neighbors[n][1] > (gridRows - 1) || neighbors[n][1] < 0)
				// Neighbor is outside grid column bounds.
				|| (neighbors[n][0] > (gridCols - 1) ||
					neighbors[n][0] < 0) ) {

				directionResult = directionMap[n](lineCursor);

				if ( directionResult ) {
					prevDirection = n;
					return directionResult;
				}

			} else {

				if ( grid[neighbors[n][1]][neighbors[n][0]] ===
					~~!currentColor ) {

					directionResult = directionMap[n](lineCursor);

					if ( directionResult ) {
						prevDirection = n;
						return directionResult;
					}
				}

			}
		}

	}


	/*
	 * Illustrator Methods
	 */

	function getIllustratorPoints(points, size) {
		var p = 0
			, numPoints = points.length
			, illPoints = [];

		for ( p; p < numPoints; p += 1 ) {

			// If the point is on the same line as the previous and next
			// points, then we don't need it.
			if ( p > 0 && p < (numPoints - 1) ) {
				p = parseInt(p);
				if ( (points[p+1][0] === points[p][0] && points[p-1][0] === points[p][0])
					|| (points[p+1][1] === points[p][1] && points[p-1][1] === points[p][1]) ) {

					continue;
				}
			}

			illPoints.push(
				[(points[p][0] * size), ((points[p][1] * size * -1) + illDocument.height)]
			);
		}

		// Remove the extraneous last point
		illPoints.pop();

		return illPoints;
	}

    function drawPath(points, color, doc) {
        var newPath = illLayer.pathItems.add(); // Use illLayer instead of doc
        var fill = new GrayColor();

        newPath.setEntirePath(points);
        newPath.stroked = false;
        newPath.filled = true;
        fill.gray = ~~color * 100;
        newPath.fillColor = fill;
        newPath.closed = true;
    }
};
