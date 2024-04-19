export const stripURLs = (inputString: string) => {
  // Define the regex pattern to match URLs starting with "(https://" and ending with ")"
  const regexPattern = /https?:\/\/[^\s]+/g;

  // Replace all occurrences of the pattern with an empty string
  const strippedString = inputString.replace(regexPattern, "");

  return strippedString;
};
