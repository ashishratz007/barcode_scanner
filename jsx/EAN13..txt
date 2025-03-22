
var doc = app.activeDocument;

app.coordinateSystem = CoordinateSystem.DOCUMENTCOORDINATESYSTEM;

var fontName = "OCRBStd";

var barcodeTextArr = [];


if (fontAvailable(fontName)) {

    //Select 13 digits and replace it with a barcode
    for (var i = 0; i < doc.textFrames.length; i++) {

        if (doc.textFrames[i].contents.match(/^\d{13}$/gi)) {

            var textParent = doc.textFrames[i].parent;

            //If layer with text is locked or invisible the script will ignore them
            if (textParent.locked == true || textParent.visible == false) {

                continue;
            };

            if (doc.textFrames[i].kind == TextType.AREATEXT) {

                areaTextJust(doc.textFrames[i]);

                doc.textFrames[i].convertAreaObjectToPointObject();


            }

            var myCode = doc.textFrames[i].contents;
            
            if (CheckDigit(myCode) != myCode[12]) {

                alert("The barcode " + myCode + " does not have the right checksum. The checksum digit must be " + CheckDigit(myCode));


            }
            else barcodeTextArr.push(doc.textFrames[i]);
        }
    };


    for (var i = 0; i < barcodeTextArr.length; i++) {

        var barcodeText = barcodeTextArr[i];

        var textParent = barcodeText.parent;

        var EANGroup = textParent.groupItems.add();

        justText(barcodeText);

        var matrix = barcodeText.matrix;

        var Angle = -180 / Math.PI * Math.atan2(matrix.mValueC, matrix.mValueD)

        var Width = barcodeText.textRange.size * 18;

        var Height = Width * 0.2;

        var newX = barcodeText.anchor[0] - Width * 0.01;

        var newY = barcodeText.anchor[1] //+ Height * 0.344;

        var roto_X = barcodeText.anchor[0];

        var roto_Y = barcodeText.anchor[1];

        var delta = Width / 20;

        var EANtext = barcodeText.contents;

        var barColor = make_cmyk(0, 0, 0, 100);

        var barcode = CreateBarcode(Width, Height, EANtext, EANGroup, barColor, barcodeText);

        var newY = barcodeText.anchor[1] + EANGroup.height;

        barcode.position = [newX, newY];

        rotate_around_point(barcode, roto_Y, roto_X, Angle);

    }

}

else {

    alert("Looks, like the " + fontName + " font is not available in you computer. Please install " + fontName + " font and try again.");

};

for (var i = 0; i < barcodeTextArr.length; i++) {

    barcodeTextArr[i].remove();

};


////////////////          FUNCTIONS        /////////////////////////////////////////////////////////////////


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
    }

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
    }

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
    }

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
    }

    this.drawLeft = function (content) {

        var mySeq = this.dictL[content[0]];

        for (var i = 1; i < content.length; i++) {

            var myLG = mySeq[i - 1];


            if (myLG == "L") {

                var parameters = this.L[content[i]];


            }

            else if (myLG == "G") {

                var parameters = this.G[content[i]];


            }

            rect = this.gr.pathItems.rectangle(this.y, this.x + this.w * parameters[0], this.w * parameters[1], this.h);

            rect.stroked = false;

            rect.filled = true;

            rect.fillColor = this.col;

            rect = this.gr.pathItems.rectangle(this.y, this.x + this.w * parameters[2], this.w * parameters[3], this.h);

            rect.stroked = false;

            rect.filled = true;

            rect.fillColor = this.col;

            this.x = this.x += this.gapD;

        }

    }

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

        //this.x = this.x += this.gapD;

        

    }
};


function fontAvailable(myName) {

    //Function checks if font exists

    var myFont = true;

    try {

        var myFont = textFonts.getByName(myName);

    }

    catch (e) {

        var myFont = false;

    }

    return myFont;
};


function make_cmyk(c, m, y, k) {

    var colorRef = new CMYKColor();

    colorRef.cyan = c;

    colorRef.magenta = m;

    colorRef.yellow = y;

    colorRef.black = k;

    return colorRef;
};


function CreateBarcode(Width, Height, BarcodeNr, Group, barColor, textArtRange) {
    // Function creates barcode

    //adjust width for correct fit
    var block = Width * 0.00346;

    var blockHeightExtra = Height * 1.07; //heigtht of barcode

    var fontSize = block * 10;//font size

    var zX = 0;

    var zY = 0;

    var BarcodeNr = textArtRange.contents;

    var gapD = block * 7;

    var whiteRect = Group.pathItems.rectangle(zY, zX - block * 10, block * 118, blockHeightExtra * 1.16);

    whiteRect.stroked = false;

    whiteRect.filled = true;

    whiteRect.fillColor = make_cmyk(0, 0, 0, 0);

    var bcRenderObject = new bcRenderChar(zX, zY, block, blockHeightExtra, barColor, Group, gapD);

    bcRenderObject.draw("sep");

    bcRenderObject.x += block * 4;

    bcRenderObject.h = Height;

    bcRenderObject.drawLeft(BarcodeNr.substring(0, 7));

    //bcRenderObject.x += block;

    bcRenderObject.h = blockHeightExtra;

     bcRenderObject.draw("sep");

     bcRenderObject.x += block * 5;

     bcRenderObject.h = Height;

     for (var j = 7; j < 12; j++) {
         

         bcRenderObject.draw(BarcodeNr[j]);

         bcRenderObject.x += gapD;

     }
     bcRenderObject.draw(BarcodeNr[12]);
     
     bcRenderObject.x += block * 6;
     bcRenderObject.h = blockHeightExtra;

     bcRenderObject.draw("sep");

    var topPos = - Height * 1.03;

    pointText(Group, fontSize, BarcodeNr.charAt(0), topPos, block - block * 9, fontName, 1);

    pointText(Group, fontSize, BarcodeNr.substring(1, 7), topPos, block + block * 3, fontName, 1);

    pointText(Group, fontSize, BarcodeNr.substring(7, 13), topPos, block + block * 49, fontName, 1);

    return Group;
};


function pointText(Group, fontSize, charNr, topPos, leftPos, fontName, fontScale) {

    //Creates barcode text

    var pointTextRef = Group.textFrames.add();

    pointTextRef.textRange.size = fontSize;

    pointTextRef.contents = charNr;

    pointTextRef.position = [leftPos, topPos];

    pointTextRef.textRange.characterAttributes.textFont = textFonts.getByName(fontName);

    pointTextRef.textRange.characterAttributes.size = pointTextRef.textRange.characterAttributes.size * fontScale;

    return pointTextRef;

};


function CheckDigit(myCode) {
    //Calculate checksum of a 13 digit number and compare to last digit
    //Number must be 13 digit long, or the calculation will be wrong
    var mySum = 0;
    for (var j = 0; j < myCode.length - 1; j = j + 1) {
        //Determine weight to multiply to current digit
        if (j % 2 == 0) {
            var weight = 1
        }
        else {
            var weight = 3
        }

        var myNumber = myCode[j] * weight;
        mySum = mySum + myNumber;


    }

    checkDigit = Math.ceil(mySum / 10) * 10 - mySum

    return checkDigit;
};


function rotate_around_point(obj, roto_X, roto_Y, angle) {
    // Utility that rotates an object around an arbitrary point

    //Translate from point to document origin 
    obj.translate(-roto_Y, -roto_X);

    //Rotate around document origin
    obj.rotate(angle, true, true, true, true, Transformation.DOCUMENTORIGIN);

    //Translate back
    obj.translate(roto_Y, roto_X);
};


function justText(mySelection) {

    //Function justificates text without moving it around

    var locArr = new Array();

    var myJust = Justification.FULLJUSTIFYLASTLINELEFT;

    locArr = addtoList(mySelection, locArr);


    for (all in locArr) {

        locArr[all][0].story.textRange.justification = myJust;

        locArr[all][0].top = locArr[all][1];

        locArr[all][0].left = locArr[all][2];
    };

    function addtoList(obj, myArray) {

        var temp = new Array();

        temp[0] = obj;

        temp[1] = obj.top;

        temp[2] = obj.left;

        myArray.push(temp);

        return myArray;
    }

};

function areaTextJust(myText) {

    //If FULLJUSTIFYLASTLINE changes to Justification
    //NB:Justification.LEFT doesn´t work

    if (myText.kind == TextType.AREATEXT) {

        if (myText.paragraphs[0].paragraphAttributes.justification == Justification.FULLJUSTIFYLASTLINECENTER) {

            myText.paragraphs[0].paragraphAttributes.justification = Justification.CENTER;

        }
        else if (myText.paragraphs[0].paragraphAttributes.justification == Justification.FULLJUSTIFYLASTLINERIGHT) {

            myText.paragraphs[0].paragraphAttributes.justification = Justification.RIGHT;

        }
        else if (myText.paragraphs[0].paragraphAttributes.justification == Justification.FULLJUSTIFYLASTLINELEFT) {

            myText.paragraphs[0].paragraphAttributes.justification = Justification.LEFT;

        }

    }
};





