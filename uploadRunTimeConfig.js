const fs = require("fs");
const { exec } = require("child_process");

fs.readFile(".runtimeconfig.json", "utf8", (err, data) => {
  if (err) {
    console.error("Error reading .runtimeconfig.json:", err);
    return;
  }

  const config = JSON.parse(data);
  const commands = [];

  for (const namespace in config) {
    console.log(namespace);
    for (const key in config[namespace]) {
      const value = config[namespace][key];
      commands.push(`firebase functions:config:set ${namespace}.${key}="${value}"`);
    }
  }

  console.log("asdfasdf");
  // exec(commands.join(" && "), (err, stdout, stderr) => {
  //   if (err) {
  //     console.error("Error setting config:", err);
  //     return;
  //   }

  //   console.log("Config set successfully");
  // });
});
