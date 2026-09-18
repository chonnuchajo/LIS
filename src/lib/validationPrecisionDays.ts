export function precisionWithAccuracyDayOne(daily: string, accuracy: string) {
  const otherDays = daily.split(/\r?\n/).filter(line => line.trim() && Number(line.split(/[,;\t]/)[0]) !== 1);
  const dayOne = accuracy ? accuracy.split(/\r?\n/).filter(line => line.trim()).map(line => `1\t${line.split(/[,;\t]/).join("\t")}`) : [];
  return [...dayOne, ...otherDays].join("\n");
}
