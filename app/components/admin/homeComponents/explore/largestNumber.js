export function findLargestByVisualWidth(min, max, stepCount) {
  try {
    const distance = max - min;

    const interval = Math.round(distance / stepCount);

    let yAxisRemake = [];

    for (let index = 0; index < stepCount; index++) {
      yAxisRemake.push(`${Math.round(min + (index + 1) * interval)}`);
    }

    const largestNumber = sortYAxisForLargest(yAxisRemake);

    return largestNumber;
  } catch (err) {
    console.log('finding larget number error', err);
    return max || 0;
  }
}

function sortYAxisForLargest(numbers) {
  const widthMap = {
    0: 7,
    1: 4,
    2: 6,
    3: 6,
    4: 6,
    5: 6,
    6: 6,
    7: 6,
    8: 7,
    9: 6,
  };

  let largest = '';
  let maxWidth = 0;

  for (const number of numbers) {
    let totalWidth = 0;
    for (const digit of number) {
      totalWidth += widthMap[digit] || 0;
    }

    if (totalWidth > maxWidth) {
      maxWidth = totalWidth;
      largest = number;
    }
  }

  return largest;
}
