import MaxHeap from './minHeap';

export function mergeArrays({
  arr1 = [],
  arr2 = [],
  n1 = 0,
  n2 = 0,
  arr3 = [],
  n3 = 0,
}) {
  // console.log('re-ordering transaactins');
  let mergedArray = [];
  const minHeap = new MaxHeap();

  // Function to push elements into the heap
  const pushToHeap = (arr, index, identifier) => {
    if (arr[index]) {
      const time =
        arr[index].paymentTime * 1000 ||
        arr[index].timestamp * 1000 ||
        arr[index].time ||
        Infinity;

      const element = {
        ...arr[index],
        [identifier === 'arr1'
          ? 'usesLightningNode'
          : identifier === 'arr2'
          ? 'usesLiquidNode'
          : 'usesEcash']: true,
        source: identifier,
        index,
        time,
      };

      minHeap.add(element);
    }
  };

  // Add first elements of each array to the heap
  if (n1 > 0) pushToHeap(arr1, 0, 'arr1');
  if (n2 > 0) pushToHeap(arr2, 0, 'arr2');
  if (n3 > 0) pushToHeap(arr3, 0, 'arr3');

  // Process heap
  while (!minHeap.isEmpty()) {
    const minElement = minHeap.poll();
    mergedArray.push(minElement);

    // Push next element from the same source array
    let {source, index} = minElement;
    if (source === 'arr1' && index + 1 < n1)
      pushToHeap(arr1, index + 1, 'arr1');
    if (source === 'arr2' && index + 1 < n2)
      pushToHeap(arr2, index + 1, 'arr2');
    if (source === 'arr3' && index + 1 < n3)
      pushToHeap(arr3, index + 1, 'arr3');
  }

  return mergedArray;
}
