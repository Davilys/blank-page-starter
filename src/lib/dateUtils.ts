/**
 * Get the next Friday date from today
 * If today is Friday, returns today's date
 * Otherwise returns the upcoming Friday
 */
export const getNextFriday = (): Date => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday
  
  // Calculate days until Friday
  let daysUntilFriday: number;
  
  if (dayOfWeek === 5) {
    // Today is Friday
    daysUntilFriday = 0;
  } else if (dayOfWeek < 5) {
    // Sunday (0) to Thursday (4)
    daysUntilFriday = 5 - dayOfWeek;
  } else {
    // Saturday (6)
    daysUntilFriday = 6; // Next Friday is 6 days away
  }
  
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);
  
  return nextFriday;
};

/**
 * Format date as DD/MM
 */
export const formatDateDDMM = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
};

/**
 * Get formatted next Friday date
 */
export const getNextFridayFormatted = (): string => {
  const nextFriday = getNextFriday();
  return formatDateDDMM(nextFriday);
};
