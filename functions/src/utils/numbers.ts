/* eslint-disable require-jsdoc */

export function truncateDecimals(numberString: string | number, decimals: number): string {
  if (typeof numberString === "number" && !isNaN(numberString) && Number.isFinite(numberString)) {
    numberString = numberString.toString();
  }

  if (typeof numberString !== "string" || isNaN(parseFloat(numberString)) || decimals < 0) {
    return "";
  }

  const [integerPart, decimalPart] = numberString.split(".");
  const truncatedDecimalPart = decimalPart ? decimalPart.substring(0, decimals) : "";

  // If the truncated decimal part is empty, return the integer part only
  if (truncatedDecimalPart === "") {
    return integerPart;
  }

  return decimals > 0 ? `${integerPart}.${truncatedDecimalPart}` : integerPart;
}
