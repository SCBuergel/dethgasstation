// based on https://ethereum.stackexchange.com/a/24238
const promisify = (inner) =>
  new Promise((resolve, reject) =>
    inner((err, res) => {
      if (err) { reject(err) }

      resolve(res);
    })
  );

const proxiedWeb3Handler = {
  get: (target, name) => {              
    const inner = target[name];                            
    if (inner instanceof Function) {                       
      return (...args) => promisify(cb => inner(...args, cb));                                                         
    } else if (typeof inner === 'object') {                
      return new Proxy(inner, proxiedWeb3Handler);
    } else {
      return inner;
    }
  },
};

// from https://github.com/30-seconds/30-seconds-of-code/blob/master/snippets/median.md
const median = arr => {
  const mid = Math.floor(arr.length / 2),
    nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

const average = list => list.reduce((prev, curr) => prev + curr) / list.length;

let proxiedWeb3;
let numBlocks = 10;
let txs = new Map();
let running = false;
let globalMinGasGWei = Number.MAX_SAFE_INTEGER;
let globalMaxGasGWei = Number.MIN_SAFE_INTEGER;

function resetAll() {
	txs.forEach((val, key, map) => {
		val.row.remove();
	});
	txs = new Map();
	running = false;
	proxiedWeb3 = undefined;
	globalMinGasGWei = Number.MAX_SAFE_INTEGER;
	globalMaxGasGWei = Number.MIN_SAFE_INTEGER;
}

async function toggle() {
	running = !running;
	console.log("Running: " + running);
	if (running) {
  	document.getElementById("toggleButton").innerText = "Stop";
		await loadBlocks();
	}
}

function createWeb3() {
	// create web3 object (because web3 endpoint might have changed)
	console.log("creating web3 object...");
	let endpointInput = document.getElementById("web3Endpoint").value;
  let endpoint;

  // first try to use the default value (if that's written in input field):
  if (endpointInput == "window.ethereum") {
    console.log("trying to use window.ethereum...");
    // if that does not exist, update UI and try fallback to Avado RYO
    if (typeof window.ethereum == "undefined") {
    	console.log("cannot find window.ethereum, switching to Avado RYO...");
    	endpoint = "https://mainnet.eth.cloud.ava.do";
    	document.getElementById("web3Endpoint").value = "https://mainnet.eth.cloud.ava.do";
    	document.getElementById("outputDiv").innerText = "Did not find local web3 provider, switched to Avado RYO. ";
    } else {
    	console.log("seems ok, using window.ethereum...")
    	endpoint = window.ethereum;
    }
  } else {
    console.log("using custom web3 endpoint: " + endpointInput);
    // otherwise just try to use the one provided
    endpoint = endpointInput;
  }

  // finally create the objects and try using that endpoint to obtain the latest block number to see if all is ok
  console.log("now creating web3 object...");
  let web3 = new Web3(endpoint);
  proxiedWeb3 = new Proxy(web3, proxiedWeb3Handler);
}

function renderAll() {
	console.log("rendering all...");
	txs.forEach((val, key, map) => {
		console.log("now rendering block " + key);
		renderBlock(key, val.gasPricesGWei, val.gasUsed, val.row);
	});
}

function renderBlock(blockNo, blockTxs, blockGasUsed, row = null) {
	console.log("start rendering...");
	var table = document.getElementById("gasTable");
	blockTxs.sort((a,b)=>a-b);
	let tenthLowestGas = blockTxs.length > 20 ? blockTxs[9] : "-";
	let minGas = blockTxs.length > 0 ? Math.min(...blockTxs) : "-";
	let medianGas = blockTxs.length > 0 ? median(blockTxs) : "-";
	let averageGas = blockTxs.length > 0 ? average(blockTxs) : "-";
	blockTxs.sort((a,b)=>b-a);
	let tenthHighestGas = blockTxs.length > 20 ? blockTxs[9] : "-";
	let maxGas = blockTxs.length > 0 ? Math.max(...blockTxs) : "-";

	if (row == null)
		row = table.insertRow();
	else {
		while (row.firstChild) {
    	row.firstChild.remove()
    }
	}
	var cell0 = row.insertCell(0);
	var cell1 = row.insertCell(1);
	var cell2 = row.insertCell(2);
	var cell3 = row.insertCell(3);
	var cell4 = row.insertCell(4);
	var cell5 = row.insertCell(5);
	var cell6 = row.insertCell(6);
	var cell7 = row.insertCell(7);
	var cell8 = row.insertCell(8);

	cell0.innerHTML = blockNo;
	cell1.innerHTML = blockTxs.length;
	cell2.innerHTML = typeof minGas === 'number' ? minGas.toFixed(2) : "-";
	cell3.innerHTML = typeof tenthLowestGas === 'number' ? tenthLowestGas.toFixed(2) : "-";
	cell4.innerHTML = typeof medianGas === 'number' ? medianGas.toFixed(2) : "-";
	cell5.innerHTML = typeof averageGas === 'number' ? averageGas.toFixed(2) : "-";
	cell6.innerHTML = typeof tenthHighestGas === 'number' ? tenthHighestGas.toFixed(2) : "-";
	cell7.innerHTML = typeof maxGas === 'number' ? maxGas.toFixed(2) : "-";
	
	const numBins = 50;
	let bins = [];
	for (let c = 0; c < numBins; c++) {
		bins[c] = 0;
	}
	let delta = (globalMaxGasGWei - globalMinGasGWei) / numBins;
	console.log("globalMaxGasGWei: " + globalMaxGasGWei + ", globalMinGasGWei: " + globalMinGasGWei + ", delta: " + delta);

	for (let c = 0; c < blockGasUsed.length; c++) {
		let binIndex = Math.floor((blockTxs[c] - globalMinGasGWei) / (globalMaxGasGWei - globalMinGasGWei ) * (numBins - 1));
		console.log("bin index: " + binIndex);
		bins[binIndex] += blockGasUsed[c];
	}

	for (let c = 0; c < bins.length; c++) {
		bins[c] = bins[c] > 0 ? Math.log10(bins[c]) : bins[c];
		console.log("bin " + c + ": " + bins[c]);
	}

	console.log("loaded bins");
	let numColors = 5;
	let minBin = Math.min(...bins);
	let maxBin = Math.max(...bins);
	let deltaBin = (maxBin - minBin) / numColors;
	console.log("minBin: " + minBin + ", maxBin: " + maxBin + ", deltaBin: " + deltaBin);
	let colorLUT = ["_", "░", "▒", "▓", "█"];
	
	if (maxBin == minBin) {
		console.log("too few entries for rendering");
		return row;
	}

	for (let c = 0; c < bins.length; c++) {
		let colorIndex = Math.floor((bins[c] - minBin) / (maxBin - minBin) * (numColors - 1));
		console.log("bin " + c + " has color " + colorIndex);
		cell8.innerText += colorLUT[colorIndex];
	}

	return row;
}

async function loadBlocks() {

  var myDiv = document.getElementById("outputDiv");
  myDiv.innerText = "Loading...";
	let start = Date.now();

	createWeb3();

	// connection check to see if endpoint is available
	console.log("trying to load latest block to see if all is ok...");
	let latestBlockFromChain = await proxiedWeb3.eth.getBlockNumber();

	let startBlock = parseInt(document.getElementById("startBlock").value);
	if (!startBlock) {
		startBlock = latestBlockFromChain;
		document.getElementById("startBlock").value = startBlock;
	}

	let numBlocks = parseInt(document.getElementById("numBlocks").value);
	numBlocks = numBlocks ? numBlocks : startBlock;

	for (let blockNo = startBlock; blockNo > startBlock - numBlocks && running; blockNo--) {
		if (txs.get(blockNo))
			continue;
		let block = await proxiedWeb3.eth.getBlock(blockNo);
	  let blockGasPrice = []; // not using JSON object for these 2 arrays to make processing easier
	  let blockGasUsed = [];

		console.log("BLOCK " + blockNo + " (" + block.transactions.length + " txs)");
		let globalLimitsChanged = false;
		// reading txs in parallel
		await Promise.all(block.transactions.map(async (tx) => {
			console.log("processing tx...");
			let gasPriceGWei = (await proxiedWeb3.eth.getTransaction(tx)).gasPrice/1e9;
			let gasUsed = (await proxiedWeb3.eth.getTransactionReceipt(tx)).gasUsed
			if (gasPriceGWei < globalMinGasGWei) {
				globalMinGasGWei = gasPriceGWei;
				globalLimitsChanged = true;
			}
			if (gasPriceGWei > globalMaxGasGWei) {
				globalMaxGasGWei = gasPriceGWei;
				globalLimitsChanged = true;
			}
			console.log(gasPriceGWei);
      blockGasPrice.push(gasPriceGWei);
      blockGasUsed.push(gasUsed);
		}));

		if (globalLimitsChanged)
			renderAll();

		let tableRow = renderBlock(blockNo, blockGasPrice, blockGasUsed);
	
		txs.set(blockNo, 
			{
				gasPricesGWei: blockGasPrice,
				gasUsed: blockGasUsed,
				row: tableRow
			}
		);
	}

	let end = Date.now();
  myDiv.innerText = "Compiled data in " + (end - start) / 1000 + " seconds";
  running = false;
	document.getElementById("toggleButton").innerText = "Load";
}

window.onload = function() {
	toggle();
}
