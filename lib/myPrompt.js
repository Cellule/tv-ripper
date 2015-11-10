var prompt = require("prompt");
prompt.start();
prompt.properties.yesno = {
    name: 'yesno',
    validator: /y[es]*|n[o]?/,
    warning: 'Must respond yes or no',
    default: 'no',
    before: function (val) {
        return val[0] === "y";
    }
};
exports["default"] = prompt;
