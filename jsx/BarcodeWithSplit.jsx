
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
        {
            // Create a sublayer inside the object's parent layer
            var objectLayer = obj.layer;
            var barcodeLayer = objectLayer.layers.add();
            barcodeLayer.name = barcodeKey + " " + (i + 1);
            generateEAN13BarcodeNew(fullEAN, barcodeX, barcodeY, barcodeWidth, 30, 5, barcodeLayer);
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
            generateEAN13BarcodeNew(fullEAN, barcodeX, barcodeY, barcodeWidth, 30, 5, barcodeLayer);
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