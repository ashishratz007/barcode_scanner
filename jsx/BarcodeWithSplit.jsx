
/// global keys
var barcodeKey = "Barcode";
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
        alert("Total objects detected: " + objects.length);
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
        var barcodeWidth = 180; // Set barcode width
        var barcodeX = objBounds[0] + (objWidth - barcodeWidth) / 2; // Center barcode
        var barcodeY = objBounds[3] - 20; // Position barcode 20px below the object
        {
            // Create a sublayer inside the object's parent layer
            var objectLayer = obj.layer;
            var barcodeLayer = objectLayer.layers.add();
            barcodeLayer.name = barcodeKey + " " + (i + 1);
            draw12DigitBarcode(fullEAN, barcodeX, barcodeY, barcodeWidth, 60, 70, barcodeLayer);
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
            barcodeLayer.name = barcodeKey + " " + (i + 1);
            draw12DigitBarcode(fullEAN, barcodeX, barcodeY, barcodeWidth, 60, 70, barcodeLayer);
        }
        // **5. Export the EPS file**
        var filePath = new File(exportFolder.fsName + "/" + fullEAN + ".eps");
        saveDocAsEPS(newDoc, filePath);

        // Close the new document without saving
        files.push(exportFolder.fsName + "/" + fullEAN + ".eps");
        newDoc.close(SaveOptions.DONOTSAVECHANGES);
    }
    // Mark that barcodes have been generated
    // markBarcodesGenerated(mainLayer);
    return (files);
}

function getMainLayer(doc) {
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

// function to check if barcod exits
function checkForBarcode() {
    var doc = app.activeDocument;
    var mainLayer = getMainLayer(doc);
    if (!mainLayer) return;
    for (var i = 0; i < doc.layers.length; i++) {
        return checkBarcodeInLayers(doc.layers[i]);
    }
    
}

// filter every layers for barcode key
function checkBarcodeInLayers(layer) {
    for (var i = layer.layers.length - 1; i >= 0; i--) {
        var subLayer = layer.layers[i];
        if (subLayer.name.indexOf(barcodeKey) !== -1) {
            return true;
        } else {
            checkBarcodeInLayers(subLayer); // Recursively check sublayers
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


// Function to Draw 12-Digit Barcode
function draw12DigitBarcode(ean, x, y, width, height, textPadding, barcodeLayer) {
    if (ean.length !== 12) {
        alert("EAN must be 12 digits long.");
        return;
    }

    var doc = app.activeDocument;
    var moduleWidth = width / 95; // Scale barcode width to keep proportions
    var moduleHeight = height;

    // Create black fill color
    var blackColor = new CMYKColor();
    blackColor.black = 100; // Full black

    // Left-hand patterns (for first 6 digits)
    var leftPatterns = {
        "0": "0001101", "1": "0011001", "2": "0010011", "3": "0111101", "4": "0100011",
        "5": "0110001", "6": "0101111", "7": "0111011", "8": "0110111", "9": "0001011"
    };

    // Right-hand patterns (for last 6 digits)
    var rightPatterns = {
        "0": "1110010", "1": "1100110", "2": "1101100", "3": "1000010", "4": "1011100",
        "5": "1001110", "6": "1010000", "7": "1000100", "8": "1001000", "9": "1110100"
    };

    // Guard and center patterns
    var guard = "101";
    var center = "01010";

    var startX = x;

    // Draw start guard
    drawBars(guard, startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);
    startX += guard.length * moduleWidth;

    // Draw first 6 digits (left-hand patterns)
    for (var i = 0; i < 6; i++) {
        var digit = ean[i];
        var pattern = leftPatterns[digit];
        if (!pattern) {
            alert("Invalid digit in EAN: " + digit);
            return;
        }
        drawBars(pattern, startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);
        startX += 7 * moduleWidth;
    }

    // Draw center guard
    drawBars(center, startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);
    startX += center.length * moduleWidth;

    // Draw last 6 digits (right-hand patterns)
    for (var i = 6; i < 12; i++) {
        var digit = ean[i];
        var pattern = rightPatterns[digit];
        if (!pattern) {
            alert("Invalid digit in EAN: " + digit);
            return;
        }
        drawBars(pattern, startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);
        startX += 7 * moduleWidth;
    }

    // Draw end guard
    drawBars(guard, startX, y, moduleWidth, moduleHeight, blackColor, barcodeLayer);

    // Add barcode number below barcode with padding
    var text = barcodeLayer.textFrames.add();
    text.contents = ean; // Display the 12-digit EAN
    text.textRange.characterAttributes.size = 14;
    text.textRange.characterAttributes.fillColor = blackColor; // Make text black

    // Center align text below barcode
    var textX = x + (width / 2) - (text.width / 2); // Center horizontally
    var textY = y - textPadding; // Padding below barcode
    text.position = [textX, textY];
}

// Function to Draw Bars with Proper Thickness and Filled Black Color
function drawBars(binary, x, y, width, height, blackColor, barcodeLayer) {
    var doc = app.activeDocument;
    for (var i = 0; i < binary.length; i++) {
        if (binary[i] === "1") {
            var rect = barcodeLayer.pathItems.rectangle(y, x + (i * width), width, height);
            rect.filled = true;
            rect.fillColor = blackColor; // Fill bars in black
            rect.stroked = false; // No stroke
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
        alert("No Need to login session token already exits : " + session_token);
        return  session_token;
        
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
    alert("login data sent to html") 
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
    var sessionFile = new File(homeFolder + "/.session_token"); // Hidden file

    if (sessionFile.open("w")) { // Open file in write mode
        sessionFile.write(session_token); // Store session token
        sessionFile.close();
        alert("Token stored: to path: " + sessionFile.path);
    } else {
        alert("Error: Unable to store session token.");
    }
}


//// delete token if get expired 
function deleteToken() {
    var homeFolder = Folder.userData; // Get user's home directory
    var sessionFile = new File(homeFolder + "/.session_token"); // Hidden file path

    if (sessionFile.exists) { // Check if file exists
        if (sessionFile.remove()) { // Delete the file
            alert("Session token deleted successfully.");
        } else {
            alert("Error: Unable to delete session token.");
        }
    } else {
        alert("No session token found.");
    }
}


/// read token
function readToken() {
    var homeFolder = Folder.userData;
    var sessionFile = new File(homeFolder + "/.session_token");

    if (sessionFile.exists) { // Check if the file exists
        if (sessionFile.open("r")) { // Open in read mode
            var session_token = sessionFile.read(); // Read token
            sessionFile.close();
            alert(session_token)
            return session_token; // Return token
        } else {
            alert("Error: Unable to read session token.");
            return null;
        }
    } else {
        alert("Session token file does not exist.");
        return null;
    }
}



function replaceArrowWithBackslash(inputString) {
    return inputString.split(">").join("\\"); // Replace all > with \
}


function deleteFiles(fileData) {
    var fileString = replaceArrowWithBackslash(fileData);

    var files = fileString.split(","); // Split into individual file paths
    alert(files);
    alert(files.length);
    for (var i = 0; i < files.length; i++) {
        var filePathNew = files[i];
        alert(filePathNew);
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
    alert("Device Name: " + deviceName + "\nSerial Number: " + serialNumber);
    return {
        deviceName: deviceName,
        serialNumber: serialNumber
    };
}
// Usage Example:
// var info = getDeviceInfo();
// alert("Device Name: " + info.deviceName + "\nSerial Number: " + info.serialNumber);


