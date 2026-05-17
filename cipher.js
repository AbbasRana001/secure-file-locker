export function vigenere(text, key, encrypt) {

    var cleanKey = "";
    for (var i = 0; i < key.length; i++) {
        var ch = key[i];
        if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {
            cleanKey += ch.toUpperCase();
        }
    }

    if (cleanKey.length === 0) {
        throw new Error("Key must contain at least one letter.");
    }

    var result = "";
    var keyIndex = 0;

    for (var i = 0; i < text.length; i++) {
        var ch = text[i];


        if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")) {

            var isUpperCase = (ch >= "A" && ch <= "Z");


            var letterValue = ch.toUpperCase().charCodeAt(0) - 65;

            var keyChar = cleanKey[keyIndex % cleanKey.length];
            var shiftAmount = keyChar.charCodeAt(0) - 65;

            var shiftedValue;
            if (encrypt) {
                shiftedValue = (letterValue + shiftAmount) % 26;
            } else {
                shiftedValue = (letterValue - shiftAmount + 26) % 26;
            }

            var newChar = String.fromCharCode(shiftedValue + 65);

            if (!isUpperCase) {
                newChar = newChar.toLowerCase();
            }

            result += newChar;

            keyIndex++;

        } else {
            result += ch;
        }
    }

    return result;
}