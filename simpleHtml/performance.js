function logPerformance() {

  function formatSizeUnits(bytes) {

    if (bytes >= 1073741824) {

      bytes = (bytes / 1073741824).toFixed(2) + " GB";

    } else if (bytes >= 1048576) {

      bytes = (bytes / 1048576).toFixed(2) + " MB";

    } else if (bytes >= 1024) {

      bytes = (bytes / 1024).toFixed(2) + " KB";

    } else if (bytes > 1) {

      bytes = bytes + " bytes";

    } else if (bytes == 1) {

      bytes = bytes + " byte";

    } else {

      bytes = "0 bytes";

    }

    return bytes;

  }

  let result = getPerData()

  const { jsHeapSizeLimit, totalJSHeapSize, usedJSHeapSize } = result;

  const displayOfHeapSizeLimit = formatSizeUnits(jsHeapSizeLimit);

  const displayOfUsedMemory = formatSizeUnits(usedJSHeapSize);

  const percentUsed = usedJSHeapSize / totalJSHeapSize;

  const percentForDisplay = percentUsed;

  console.log(

    `Memory used %${percentForDisplay}, limit of ${displayOfHeapSizeLimit}, used ${displayOfUsedMemory}`

  );

}

const getPerData = () => {

    return window.performance.memory

}

 

setInterval(() => {

  logPerformance();

}, 5000);