/* Gemini Nano API - Global variables and functions */
let horizontalOffset = 0;
let myNodeIdCounter = 0;
let mySession = null;
const myInputPrompt = document.getElementById('myInputPrompt');
const myOutput = document.getElementById('myOutput');
const myDiv01 = document.getElementById('myDiv01');
const myStreamButton = document.getElementById('myStreamButton');
const myLoadButton = document.getElementById('myLoadButton');
const mySaveButton = document.getElementById('mySaveButton');
let myStartTime = 0;
let myTimerInterval = null;
let myLastGeneratedText = '';
let myController = null;
let myIsProcessing = false;

// Global variables for the summarization part
let seconds = 0; // for the timer
let timerInterval = null; // for the timer
const statusMessage = document.getElementById('statusMessage'); // Reference to the status message div
const contentArea = document.getElementById('contentArea'); // Reference to the textarea for summaries

// Get references to dialog elements and their buttons
const myEditNodeDialog = document.getElementById("myEditNodeDialog");
const myEditNodeSaveButton = document.getElementById("myEditNodeSave");
const myEditNodeCancelButton = document.getElementById("myEditNodeCancel");

const myAddNodeDialog = document.getElementById('myAddNodeDialog');
const myNewNodeNameInput = document.getElementById('myNewNodeName'); // Input for new node name
const myNewNodeParentIdInput = document.getElementById('myNewNodeParentId'); // Input for new node parent ID
const myNewNodeFactInput = document.getElementById('myNewNodeFact'); // Input for new node fact
const myGenerateNodeButton = document.getElementById('myGenerateNodeButton'); // New button for LLM generation
const myGenerateLoopNumberInput = document.getElementById('myGenerateLoopNumber'); // Input for number of loops
const myAddNodeSaveButton = document.getElementById('myAddNodeSaveButton'); // Changed ID from 'mySaveNewNode'
const myAddNodeCancelButton = document.getElementById('myAddNodeCancelButton'); // Changed ID from 'myCancelNewNode'

const myAddLineDialog = document.getElementById('myAddLineDialog');
const myJoiningFactInput = document.getElementById('myJoiningFact'); // Input for joining fact
const myAddLineSaveButton = document.getElementById('myAddLineSaveButton'); // Changed ID from 'mySaveNewLine'
const myAddLineCancelButton = document.getElementById('myAddLineCancelButton'); // Changed ID from 'myCancelNewLine'

// Assuming these buttons exist in your HTML with these IDs
const myEditButton = document.getElementById('myEditButton');
const myDeleteD3Button = document.getElementById('myDeleteD3Button'); // Changed to match HTML
const myRefreshColorsButton = document.getElementById('myRefreshColorsButton'); // Assuming you want a refresh colors button
const myFitScreenD3Button = document.getElementById('myFitScreenD3Button'); // Changed to match HTML
const myAddD3Button = document.getElementById('myAddD3Button'); // Changed to match HTML (button to open the add node dialog)
const myAddLineD3Button = document.getElementById('myAddLineD3Button'); // Changed to match HTML (button to open the add line dialog)
const myLayoutSelector = document.getElementById('myLayoutSelector'); // For the layout dropdown
const myLoadD3Button = document.getElementById('myLoadD3Button'); // For loading D3 data from file
const myFileLoadInput = document.getElementById('myFileLoad'); // Hidden file input
const mySaveD3Button = document.getElementById('mySaveD3Button'); // For saving D3 graph data

function myEditNode() {
    // Check if exactly one node is selected to be edited.
    if (mySelectedNodes.length !== 1) {
        myShowMessage("Please select a single node to edit.");
        return;
    }
    const mySelectedNode = mySelectedNodes[0];
    const myEditNameInput = document.getElementById("myEditNodeName");
    const myEditFactInput = document.getElementById("myEditNodeFact");

    // Pre-fill the input fields with the selected node's data.
    myEditNameInput.value = mySelectedNode.data.name;
    myEditFactInput.value = mySelectedNode.data.fact || "";

    // Store the node's ID on the dialog for easy access later.
    myEditNodeDialog.dataset.nodeId = mySelectedNode.id;

    // Display the dialog.
    myEditNodeDialog.style.display = "block";
}

function mySaveEditedNode() {
    const myNodeIdToEdit = myEditNodeDialog.dataset.nodeId;
    // Find the node in the current graph data using its ID.
    const myNodeToEdit = myRootNode.descendants().find(d => d.id === myNodeIdToEdit);

    if (!myNodeToEdit) {
        myShowMessage("Error: Could not find the node to edit.");
        return;
    }

    // Get the new name and fact from the input fields.
    const myNewName = document.getElementById("myEditNodeName").value;
    const myNewFact = document.getElementById("myEditNodeFact").value;

    // Update the data object.
    myNodeToEdit.data.name = myNewName;
    myNodeToEdit.data.fact = myNewFact;

    // Hide the dialog and unselect all nodes.
    myEditNodeDialog.style.display = "none";
    myUnselectAllNodes();

    // Redraw the graph to show the updated name and fact.
    myUpdate(myRootNode);

    myShowMessage(`Node "${myNewName}" has been updated.`);
}

function myCancelEditNode() {
    myEditNodeDialog.style.display = "none";
    myUnselectAllNodes();
    myShowMessage("Node edit cancelled.");
}


function myRefreshGraph() {
    // 1. Get the latest raw data from the current graph nodes
    // Define the color scale, just like in your myUpdate function.
    // This is necessary because myUpdate() is not being called.
    const myColorScale = d3.scaleOrdinal(['#69a3b2', '#7dd95c', '#c7c7c7', '#2c3e50', '#f39c12', '#800080']);
    // Select all elements with the class "node"
    d3.selectAll(".node")
        // Use the .select("circle") to grab the circle element inside each node group
        .select("circle")
        // Manually apply the fill color based on the node's depth property
        .style("fill", d => myColorScale(d.depth));

    myShowMessage("Node colors have been refreshed.");
}

function myUpdateTimerDisplay() {
    const myElapsed = (Date.now() - myStartTime) / 1000;
    myDiv01.textContent = `Thinking... ${myElapsed.toFixed(2)}s`;
}
function myResetStreamState() {
    myLastGeneratedText = '';
    myOutput.value = '';
    if (myTimerInterval) {
        clearInterval(myTimerInterval);
        myTimerInterval = null;
    }
    myController = null;
}
async function myLoadModel() {
    if (myIsProcessing) return;
    myDiv01.textContent = 'Loading model...';
    try {
        myIsProcessing = true;
        if (typeof LanguageModel === 'undefined') {
            myDiv01.textContent = 'Error: LanguageModel API is not available. Please enable the required flags.';
            return;
        }
        mySession = await LanguageModel.create();
        myDiv01.textContent = 'Model loaded successfully. Ready to generate graph.';
        myLoadButton.disabled = true;
    } catch (myError) {
        myDiv01.textContent = `Error loading model: ${myError.message}`;
    } finally {
        myIsProcessing = false;
    }
}
async function myToggleStream() {
    if (myStreamButton.textContent === 'Stop' && myController) {
        myController.abort();
        return;
    }
    if (myIsProcessing) return;
    myResetStreamState();

    // --- MODIFICATION START ---
    const basePrompt = myInputPrompt.value.trim();
    const contentAreaText = contentArea.value.trim();

    if (!basePrompt && !contentAreaText) {
        myOutput.value = 'Please enter a prompt or summarize content first.';
        myDiv01.textContent = '...';
        return;
    }

    // Combine the base prompt and contentArea text
    let finalPrompt = basePrompt;
    if (contentAreaText) {
        finalPrompt += "\n\n" + contentAreaText;
    }
    // --- MODIFICATION END ---

    if (!mySession) {
        myOutput.value = 'Please load the model first.';
        myDiv01.textContent = '...';
        return;
    }

    myStreamButton.textContent = 'Stop';
    mySaveButton.disabled = true;
    myStartTime = Date.now();
    myTimerInterval = setInterval(myUpdateTimerDisplay, 100);
    myController = new AbortController();
    try {
        myIsProcessing = true;
        // --- MODIFICATION: Use finalPrompt instead of myPrompt ---
        const myStream = await mySession.promptStreaming(finalPrompt, {
            signal: myController.signal,
            outputLanguage: 'en'
        });
        for await (const myChunk of myStream) {
            myLastGeneratedText += myChunk;
            myOutput.value = myLastGeneratedText;
            myOutput.scrollTop = myOutput.scrollHeight;
        }
        const myStartIndex = myLastGeneratedText.indexOf('{');
        const myEndIndex = myLastGeneratedText.lastIndexOf('}');
        if (myStartIndex !== -1 && myEndIndex !== -1) {
            const mySanitizedText = myLastGeneratedText.substring(myStartIndex, myEndIndex + 1);
            try {
                const myGeneratedJSON = JSON.parse(mySanitizedText);

                const mySanitizedNodes = myGeneratedJSON.nodes.map(node => {
                    // Ensure 'id' is a string
                    node.id = String(node.id);
                    // Ensure 'parentId' is a string or null/empty string
                    if (node.parentId !== null && node.parentId !== undefined) {
                        node.parentId = String(node.parentId);
                    }
                    return node;
                });
                // Create a new data object with the sanitized nodes
                const mySanitizedJSONData = {
                    nodes: mySanitizedNodes,
                    links: myGeneratedJSON.links
                };

                d3.select("#mySvgContainer g").selectAll("*").remove();
                myDrawData(myGeneratedJSON);
            } catch (e) {
                myDiv01.textContent = `Error: Generated output is not valid JSON. ${e.message}`;
            }
        }
    } catch (myError) {
        if (myError.name === 'AbortError') {
            myDiv01.textContent = 'Streaming stopped by user.';
        } else {
            myOutput.value = `Error streaming prompt: ${myError.message}`;
        }
    } finally {
        clearInterval(myTimerInterval);
        const myEndTime = Date.now();
        const myDurationSeconds = (myEndTime - myStartTime) / 1000;
        const myCharCount = myLastGeneratedText.length;
        const myWordCount = myLastGeneratedText.split(/\s+/).filter(myWord => myWord.length > 0).length;
        const myCharsPerSecond = myDurationSeconds > 0 ? (myCharCount / myDurationSeconds).toFixed(2) : '0.00';
        const myWordsPerSecond = myDurationSeconds > 0 ? (myWordCount / myDurationSeconds).toFixed(2) : '0.00';
        myDiv01.innerHTML =
            `Completed in ${myDurationSeconds.toFixed(2)}s<br>` +
            `Chars: ${myCharCount} (${myCharsPerSecond}/s)<br>` +
            `Words: ${myWordCount} (${myWordsPerSecond}/s)`;
        myStreamButton.textContent = 'Generate Graph';
        myStreamButton.disabled = false;
        mySaveButton.disabled = false;
        myIsProcessing = false;
        myController = null;
    }
}
function mySaveJSONFile() {
    const myOutputText = myOutput.value;
    if (myOutputText.trim() === '') {
        myDiv01.textContent = 'Output is empty. Nothing to save.';
        return;
    }
    try {
        const myStartIndex = myOutputText.indexOf('{');
        const myEndIndex = myOutputText.lastIndexOf('}');
        if (myStartIndex === -1 || myEndIndex === -1) {
            myDiv01.textContent = 'Error: No valid JSON object found in the output.';
            return;
        }
        const mySanitizedText = myOutputText.substring(myStartIndex, myEndIndex + 1);
        JSON.parse(mySanitizedText);
        const myBlob = new Blob([mySanitizedText], { type: 'application/json' });
        const myUrl = URL.createObjectURL(myBlob);
        const myLink = document.createElement('a');
        myLink.href = myUrl;
        myLink.download = 'data.json';
        document.body.appendChild(myLink);
        myLink.click();
        document.body.removeChild(myLink);
        URL.revokeObjectURL(myUrl);
        myDiv01.textContent = 'JSON file saved successfully.';
    } catch (e) {
        myDiv01.textContent = `Error: The sanitized output is not valid JSON. Details: ${e.message}`;
    }
}
/* D3.js - Global variables and functions */
let mySvg, myWidth, myHeight;
let myTreeLayout;
let myRootNode;
let myArbitraryLinks = [];
let myIsDragging = false;
let mySelectedNodes = [];
let myZoomBehavior;
const myLineGenerator = d3.line().x(d => d.x).y(d => d.y);
const myDefaultData = {
    nodes: [
        { id: "1", parentId: "", name: "Root", fact: "This is the initial root node." },
    ],
    links: []
};


// Function to make a dialog draggable
function myMakeDraggable(dialogId, headerSelector) {
    const myDialog = document.getElementById(dialogId);
    if (!myDialog) {
        console.error(`Error: Dialog with ID '${dialogId}' not found.`);
        return;
    }
    const myHeader = myDialog.querySelector(headerSelector);
    if (!myHeader) {
        console.error(`Error: Header with selector '${headerSelector}' not found in dialog with ID '${dialogId}'.`);
        return;
    }
    myHeader.onmousedown = (e) => {
        e.preventDefault();
        let myOffsetX = e.clientX - myDialog.offsetLeft;
        let myOffsetY = e.clientY - myDialog.offsetTop;
        function myMouseMove(e) {
            myDialog.style.top = (e.clientY - myOffsetY) + 'px';
            myDialog.style.left = (e.clientX - myOffsetX) + 'px';
        }
        function myMouseUp() {
            window.removeEventListener('mousemove', myMouseMove);
            window.removeEventListener('mouseup', myMouseUp);
        }
        window.addEventListener('mousemove', myMouseMove);
        window.addEventListener('mouseup', myMouseUp);
    };
}
function myZoomed(event) {
    mySvg.attr("transform", event.transform);
}

function myDeleteSelectedNodes() {
    if (mySelectedNodes.length === 0) {
        myShowMessage("Please select one or more nodes to delete.");
        return;
    }
    const myNodesToDelete = new Set();
    mySelectedNodes.forEach(node => {
        // Collect all selected nodes and their descendants for deletion
        node.descendants().forEach(d => myNodesToDelete.add(d.id));
    });

    // Get the current flat data and save positions
    const myRawData = myRootNode.descendants().map(d => d.data);
    const myCurrentPositions = new Map(myRootNode.descendants().map(d => [d.id, { x: d.x, y: d.y }]));

    // Filter the raw data to remove all nodes marked for deletion.
    const myFilteredData = myRawData.filter(d => !myNodesToDelete.has(d.id));

    // Filter arbitrary links to remove any that connect to a deleted node.
    myArbitraryLinks = myArbitraryLinks.filter(link =>
        !myNodesToDelete.has(link.sourceId) && !myNodesToDelete.has(link.targetId)
    );

    // Attempt to rebuild the hierarchy from the filtered data.
    // This is the critical step to re-establish the tree.
    try {
        myRootNode = d3.stratify()
            .id(d => d.id)
            .parentId(d => d.parentId)(myFilteredData);

        // Reapply saved positions to the remaining nodes
        myRootNode.descendants().forEach(d => {
            const oldPos = myCurrentPositions.get(d.id);
            if (oldPos) {
                d.x = oldPos.x;
                d.y = oldPos.y;
            }
        });

        // Update the graph with the new hierarchy.
        myUpdate(myRootNode);

    } catch (e) {
        myShowMessage("Could not rebuild graph hierarchy. A child node may have lost its parent.");
        console.error(e);
        return;
    }

    myUnselectAllNodes();
    myShowMessage(`Deleted ${myNodesToDelete.size} node(s) and their descendants.`);
}


function myCustomLayout() {
    myRefreshGraph();
    // A constant for vertical spacing. This controls the distance between levels.
    const verticalSpacing = 40;
    // A constant for horizontal spacing. This is the minimum space between nodes on the same level.
    const horizontalSpacing = 20;

    // A mapping to track the current x-position for each level.
    const xPositionsByLevel = new Map();

    // Get all nodes from the graph, sorted by their depth.
    // This is crucial to ensure we position nodes level by level.
    const myNodes = myRootNode.descendants().sort((a, b) => a.depth - b.depth);

    // Loop through each node to calculate its new position.
    myNodes.forEach(d => {
        // --- Step 1: Calculate the vertical position (y-coordinate) ---
        // This is based purely on the node's depth.
        // The root node (depth 0) is at y=0, children at y=100, and so on.
        d.y = d.depth * verticalSpacing;

        // --- Step 2: Calculate the horizontal position (x-coordinate) ---
        // We need to avoid overlapping text on the same level.
        // We'll estimate the width of the node's text label.
        // A rough estimate: 8 pixels per character, plus a fixed buffer.
        const nameWidth = d.data.name.length * 8 + 20;

        // Get the last x-position used on this level. If none exists, start at 0.
        const lastX = xPositionsByLevel.get(d.depth) || 0;

        // The new x-position is the last position plus our estimated width and a buffer.
        d.x = lastX + (nameWidth / 2) + horizontalSpacing;

        // Store the new x-position for the next node on this level.
        xPositionsByLevel.set(d.depth, d.x + (nameWidth / 2));
    });

    // Call your myUpdate function to redraw the graph with the new coordinates.
    myUpdate(myRootNode);

    myShowMessage("Graph layout has been manually reorganized.");
}


function myChangeLayout() {
    const layoutType = document.getElementById('myLayoutSelector').value;
    myTidyUpGraph(layoutType);
}

function myTidyUpGraph(layoutType) {
    if (!myRootNode) return;
    // Apply the selected layout
    if (layoutType === 'tree') {
        myTreeLayout = d3.tree().size([myWidth, myHeight - 75]);
        myTreeLayout(myRootNode);
    } else if (layoutType === 'radial') {
        myTreeLayout = d3.tree().size([2 * Math.PI, Math.min(myWidth, myHeight) / 2]);
        myTreeLayout(myRootNode);
        myRootNode.descendants().forEach(d => {
            d.x = d.y * Math.cos(d.x - Math.PI / 2);
            d.y = d.y * Math.sin(d.x - Math.PI / 2);
        });
    } else if (layoutType === 'cluster') {
        myTreeLayout = d3.cluster().size([myWidth, myHeight - 75]);
        myTreeLayout(myRootNode);
    }
    else if (layoutType === 'personal') {
        myCustomLayout()
    }


    myUpdate(myRootNode);
    myShowMessage(`Graph layout has been reset to ${layoutType}.`);
}



function myFitToScreen() {
    const myNodeElements = d3.selectAll(".node").nodes();
    const myLinkElements = d3.selectAll(".link, .arbitrary-link").nodes();
    const allElements = [...myNodeElements, ...myLinkElements];
    if (allElements.length === 0) {
        return;
    }
    const myCombinedBoundingBox = allElements.reduce((box, el) => {
        const b = el.getBBox();
        return {
            x: Math.min(box.x, b.x),
            y: Math.min(box.y, b.y),
            width: Math.max(box.width, b.x + b.width),
            height: Math.max(box.height, b.y + b.height)
        };
    }, { x: Infinity, y: Infinity, width: -Infinity, height: -Infinity });
    const myScale = Math.min(myWidth / myCombinedBoundingBox.width, myHeight / myCombinedBoundingBox.height) * 0.9;
    const myTranslateX = (myWidth / 2) - (myCombinedBoundingBox.x + myCombinedBoundingBox.width / 2) * myScale;
    const myTranslateY = (myHeight / 2) - (myCombinedBoundingBox.y + myCombinedBoundingBox.height / 2) * myScale;
    d3.select("#mySvgContainer")
        .transition()
        .duration(750)
        .call(myZoomBehavior.transform, d3.zoomIdentity.translate(myTranslateX, myTranslateY).scale(myScale));
}

function findHighestIdNumber() {
    let maxId = 0;
    // Get all the nodes currently in the graph.
    const allNodes = myRootNode.descendants();

    // Loop through each node.
    allNodes.forEach(node => {
        // A regular expression to find one or more digits at the end of the string.
        const match = node.id.match(/\d+$/);

        // If a number is found, convert it to an integer and check if it's the new highest.
        if (match) {
            const idNumber = parseInt(match[0]);
            if (idNumber > maxId) {
                maxId = idNumber;
            }
        }
    });

    return maxId;
}


// Corrected myDrawData function
function myDrawData(data) {
    const myRawData = data.nodes;
    myArbitraryLinks = data.links;
    myRootNode = d3.stratify()
        .id(d => d.id.toString()) // Ensure ID is always a string
        .parentId(d => d.parentId)(myRawData);

    // Call the function to find the highest number from existing IDs
    // and set the global counter to that value.
    myNodeIdCounter = findHighestIdNumber();
    console.log('myNodeIdCounter');
    console.log(myNodeIdCounter);
    // Apply the tree layout to get a starting point for all nodes
    myTreeLayout(myRootNode);

    // Now, iterate and restore positions from saved data, using the layout's values as a fallback
    myRootNode.descendants().forEach(d => {
        const myLoadedData = myRawData.find(item => item.id === d.id);
        if (myLoadedData && myLoadedData.x !== undefined && myLoadedData.y !== undefined) {
            // Restore saved position
            d.x = +myLoadedData.x;
            d.y = +myLoadedData.y;
        }
        // Initialize the old positions for a smooth animation
        d.x0 = d.x;
        d.y0 = d.y;
    });

    myUpdate(myRootNode);
}
// Add this function anywhere in your script
function myValidateGraph() {
    if (!myRootNode) return;
    myRootNode.descendants().forEach(d => {
        if (isNaN(d.x) || d.x === undefined) d.x = 0;
        if (isNaN(d.y) || d.y === undefined) d.y = 0;
        if (isNaN(d.x0) || d.x0 === undefined) d.x0 = d.x;
        if (isNaN(d.y0) || d.y0 === undefined) d.y0 = d.y;
    });
}

function myUpdate(source) {
    myValidateGraph()
    // let myColorScale = d3.scaleOrdinal(d3.schemeCategory10);
    let myColorScale = d3.scaleOrdinal(['#69a3b2', '#7dd95c', '#c7c7c7', '#2c3e50', '#f39c12', '#800080']);
    const myNodeData = myRootNode.descendants();
    const myTreeLinkData = myRootNode.links();
    const myNodesById = new Map(myNodeData.map(d => [d.id, d]));
    const myFactDialog = document.getElementById("myFactDialog");
    const myFactDisplayArea = document.getElementById("myFactDisplayArea");
    const myDragBehavior = d3.drag()
        .on("start", myDragStart)
        .on("drag", myDragged)
        .on("end", myDragEnd);
    const myTreeLink = mySvg.selectAll(".link")
        .data(myTreeLinkData, d => d.target.id);
    myTreeLink.enter().append("path")
        .attr("class", "link")
        .attr("d", d => myLineGenerator([source, d.target]))
        .merge(myTreeLink)
        .transition()
        .duration(500)
        .attr("d", d => myLineGenerator([d.source, d.target]));
    myTreeLink.exit().remove();
    const validArbitraryLinks = myArbitraryLinks.filter(d => myNodesById.has(d.sourceId) && myNodesById.has(d.targetId));
    const myArbitraryLinkPath = mySvg.selectAll(".arbitrary-link")
        .data(validArbitraryLinks, d => `${d.sourceId}-${d.targetId}`);
    myArbitraryLinkPath.enter().append("path")
        .attr("class", "arbitrary-link")
        .attr("id", d => `path-${d.sourceId}-${d.targetId}`)
        .attr("d", d => myLineGenerator([myNodesById.get(d.sourceId), myNodesById.get(d.targetId)]))
        .merge(myArbitraryLinkPath)
        .attr("d", d => myLineGenerator([myNodesById.get(d.sourceId), myNodesById.get(d.targetId)]));
    const myArbitraryLinkText = mySvg.selectAll(".line-text")
        .data(validArbitraryLinks, d => `text-${d.sourceId}-${d.targetId}`);
    myArbitraryLinkText.enter().append("text")
        .attr("class", "line-text")
        .merge(myArbitraryLinkText)
        .html(d => `<textPath href="#path-${d.sourceId}-${d.targetId}" startOffset="50%">${d.joiningFact}</textPath>`);
    myArbitraryLinkText.exit().remove();
    const myNode = mySvg.selectAll(".node")
        .data(myNodeData, d => d.id);
    const myNodeEnter = myNode.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${source.x0},${source.y0})`)
        .on("click", myClickNode)
        .on("mouseover", (event, d) => {
            d3.select(event.currentTarget).select("circle").style("stroke", "cyan");
            if (d.data.fact) {
                document.getElementById("myShowDiv").textContent = d.data.fact;
                // myFactDisplayArea.value = d.data.fact;
                // myFactDialog.style.display = "block";
                // myFactDialog.style.left = (event.pageX + 10) + 'px';
                // myFactDialog.style.top = (event.pageY - myFactDialog.offsetHeight - 10) + 'px';
            }
        })
        .on("mouseout", (event) => {
            d3.select(event.currentTarget).select("circle").style("stroke", "steelblue");
            // myFactDialog.style.display = "none";
        });
    myNodeEnter.append("circle")
        .attr("r", 10)
        .style("fill", d => myColorScale(d.depth)) // <-- New code
        .style("stroke", "steelblue")
        .style("stroke-width", "2px");
    myNodeEnter.append("text")
        .attr("dy", "0.31em")
        .attr("x", 15) // Fixed x-position to the right of the circle
        .attr("text-anchor", "start") // Fixed text alignment to "start" (left-aligned)
        .text(d => d.data.name)
        .style("fill", "#2c3e50");
    const myNodeUpdate = myNodeEnter.merge(myNode);
    // === CHANGE 2: In the UPDATE/MERGE selection, update the text to keep it current. ===
    // This also ensures consistent positioning for all nodes.
    myNodeUpdate.select("text")
        .attr("x", 15) // Fixed x-position to the right of the circle
        .attr("text-anchor", "start") // Fixed text alignment
        .text(d => d.data.name);

    myNodeUpdate.transition()
        .duration(500)
        .attr("transform", d => `translate(${d.x},${d.y})`);
    myNodeUpdate.call(myDragBehavior);
    myNode.exit().remove();
    myNodeData.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
    });
}
function myDragStart(event, d) {
    myIsDragging = true;
    d3.select(this).raise().classed("dragging", true);
}
function myDragged(event, d) {
    d.x = event.x;
    d.y = event.y;
    d3.select(this).attr("transform", `translate(${d.x},${d.y})`);
}
function myDragEnd(event, d) {
    myIsDragging = false;
    d3.select(this).classed("dragging", false);
    myUpdate(d);
    myShowMessage(d.data.fact || "No fact available for this node.");
}
function myClickNode(event, d) {
    event.stopPropagation();
    if (myIsDragging) return;
    if (event.ctrlKey) {
        const myIndex = mySelectedNodes.indexOf(d);
        if (myIndex > -1) {
            mySelectedNodes.splice(myIndex, 1);
            d3.select(event.currentTarget).classed('selected', false).select("circle").style("fill", "#69a3b2");
        } else {
            mySelectedNodes.push(d);
            d3.select(event.currentTarget).classed('selected', true).select("circle").style("fill", "crimson");
        }
    } else {
        myUnselectAllNodes();
        d3.select(event.currentTarget).classed('selected', true).select("circle").style("fill", "crimson");
        mySelectedNodes.push(d);
        if (d.data.fact) {
            // myShowMessage(d.data.fact);  // not needed since mouseover does it
        } else {
            myShowMessage("No fact available for this node. Use the **Ctrl key** to select multiple nodes for adding a line.");
        }
    }
}
function myUnselectAllNodes() {
    d3.selectAll('.node.selected')
        .classed('selected', false)
        .select("circle").style("fill", "#69a3b2");
    mySelectedNodes = [];
}
function myShowMessage(message) {
    //  document.getElementById("myFactDisplayArea").value = message;
    document.getElementById("myShowDiv").textContent += message;
    // console.log(message)
    // Clear the message after 5 seconds
    setTimeout(() => {
        document.getElementById("myShowDiv").textContent = '';
    }, 5000); // 5000 milliseconds = 5 seconds

}
function myShowAddNodeDialog() {
    if (mySelectedNodes.length === 1) {
        myNewNodeParentIdInput.value = mySelectedNodes[0].id;
        myNewNodeNameInput.value = '';
        myNewNodeFactInput.value = '';
        myAddNodeDialog.style.display = 'block';
    } else if (mySelectedNodes.length === 0) {
        myShowMessage("Please select a single node to be the parent of the new node.");
    } else {
        myShowMessage("Please select ONLY one node to add a child node to.");
    }
}

function myCancelAddNode() {
    myAddNodeDialog.style.display = 'none';
    myUnselectAllNodes();
    myShowMessage("Add node cancelled.");
}


// Corrected myAddNewNode function
async function myAddNewNode(shouldCloseDialog = true) { // Made async for myGenerateNodesLoop calls
    // If called from the "Add" button, it's a single manual addition.
    // If called by myAddGenerateNode, it's part of a loop.
    if (!myGenerateNodeButton || !myGenerateLoopNumberInput) {
        myShowMessage("Internal error: Generation controls not found.");
        return;
    }

    const myNewNodeName = myNewNodeNameInput.value.trim();
    const myNewNodeParentId = myNewNodeParentIdInput.value;
    const myNewNodeFact = myNewNodeFactInput.value.trim();

    if (!myNewNodeName || !myNewNodeParentId) {
        myShowMessage("Node Name and Parent ID are required.");
        return;
    }

    const myRawData = myRootNode.descendants().map(d => d.data);

    myNodeIdCounter++;
    const myNewNodeId = myNodeIdCounter.toString();

    myRawData.push({
        id: myNewNodeId,
        parentId: myNewNodeParentId,
        name: myNewNodeName,
        fact: myNewNodeFact || ""
    });

    // Save current positions to restore them later
    const myCurrentPositions = new Map(myRootNode.descendants().map(d => [d.id, { x: d.x, y: d.y }]));

    // Rebuild the D3 hierarchy with the new data
    myRootNode = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.parentId)(myRawData);

    // Apply the layout to get initial positions for all nodes, including the new one
    myTreeLayout(myRootNode);

    // Now, position the new node relative to its parent
    const myNewNode = myRootNode.descendants().find(d => d.id === myNewNodeId);
    if (myNewNode && myNewNode.parent) {
        // Place the new node near its parent
        myNewNode.x = myNewNode.parent.x + 20; // Example offset
        myNewNode.y = myNewNode.parent.y + 50; // Example offset
    }


    // Reapply saved positions to the original nodes
    myRootNode.descendants().forEach(d => {
        const oldPos = myCurrentPositions.get(d.id);
        if (oldPos && d.id !== myNewNodeId) { // Don't overwrite new node's calculated position
            d.x = oldPos.x;
            d.y = oldPos.y;
        }
    });

    myUpdate(myRootNode);
    if (shouldCloseDialog) {
        myAddNodeDialog.style.display = 'none';
    }
    myUnselectAllNodes();
    myShowMessage(`Node "${myNewNodeName}" added.`);
}

async function myGenerateNodesLoop(parentName, parentId, nameInput, factInput, numLoops) {
    let parentNode = myRootNode.descendants().find(d => d.id == parentId);
    let existingChildrenCount = parentNode.children ? parentNode.children.length : 0;
    for (let i = 0; i < numLoops; i++) {
        let generatedName = '';
        if (i === 0 && nameInput.value !== '') {
            generatedName = nameInput.value.trim();
        } else {
            nameInput.value = 'Generating name...';
            const namePrompt = `Generate a one or two word sub-concept for the term ${parentName}.`;
            const newName = await mySession.promptStreaming(namePrompt, { signal: new AbortController().signal });
            for await (const chunk of newName) {
                generatedName += chunk;
            }
            nameInput.value = generatedName.trim();
        }

        factInput.value = 'Generating fact...';
        const factPrompt = `Generate one short, interesting, and concise fact about ${generatedName}. Do not include any text other than the fact itself.`;
        const newFact = await mySession.promptStreaming(factPrompt, { signal: new AbortController().signal });
        let generatedFact = '';
        for await (const chunk of newFact) {
            generatedFact += chunk;
        }
        factInput.value = generatedFact.trim();

        const myRawData = myRootNode.descendants().map(d => d.data);
        const newId = ++myNodeIdCounter;

        myRawData.push({
            id: newId.toString(), // Ensure ID is a string
            parentId: parentId,
            name: generatedName,
            fact: generatedFact || ""
        });

        const myCurrentPositions = new Map(myRootNode.descendants().map(d => [d.id, { x: d.x, y: d.y }]));

        myRootNode = d3.stratify()
            .id(d => d.id)
            .parentId(d => d.parentId)(myRawData);

        myTreeLayout(myRootNode);

        myRootNode.descendants().forEach(d => {
            const oldPos = myCurrentPositions.get(d.id);
            if (oldPos) {
                d.x = oldPos.x;
                d.y = oldPos.y;
                d.x0 = d.x;
                d.y0 = d.y;
            }
        });

        myUpdate(myRootNode);

        if (i < numLoops - 1) {
            nameInput.value = '';
            factInput.value = '';
        }
    }
    document.getElementById('myAddNodeDialog').style.display = 'none';
    myUnselectAllNodes();
    myShowMessage(`Added ${numLoops} new node(s) to "${parentName}".`);
}

async function myAddGenerateNode() {
    if (mySelectedNodes.length !== 1) {
        myShowMessage("Please select a single parent node to generate children.");
        return;
    }

    if (!mySession) {
        myShowMessage("Please load the Gemini Nano model first.");
        return;
    }

    const parentNode = mySelectedNodes[0];
    const parentName = parentNode.data.name;
    const parentId = parentNode.id;
    const numLoops = parseInt(myGenerateLoopNumberInput.value, 10);

    if (isNaN(numLoops) || numLoops <= 0) {
        myShowMessage("Please enter a valid number of nodes to generate (1 or more).");
        return;
    }

    // Pass the input elements directly to the loop function for updating
    await myGenerateNodesLoop(parentName, parentId, myNewNodeNameInput, myNewNodeFactInput, numLoops);
}


async function myGenerateFact(myInData, myOutFact, myPrompt) {
    if (mySelectedNodes.length !== 1) {
        myShowMessage("Please select a single node to generate a fact for.");
        return;
    }
    if (!mySession) {
        myShowMessage("Please load the Gemini Nano model first.");
        return;
    }

    const myNodeName = myInData; // This should be the actual node name, not an element
    const myNewNodeFactInput = myOutFact; // This should be the fact input element
    myNewNodeFactInput.value = 'Generating ...';
    myNewNodeFactInput.disabled = true;

    try {
        const myStream = await mySession.promptStreaming(myPrompt);
        let myFact = '';
        for await (const myChunk of myStream) {
            myFact += myChunk;
            myNewNodeFactInput.value = myFact;
        }
        myShowMessage(`Fact generated for "${myNodeName}".`);
    } catch (error) {
        myNewNodeFactInput.value = 'Error generating fact.';
        myShowMessage(`Error generating fact: ${error.message}`);
    } finally {
        myNewNodeFactInput.disabled = false;
    }
}

// Placeholder functions for Add Line dialog, assuming similar structure
function myShowAddLineDialog() {
    if (mySelectedNodes.length < 2) {
        myShowMessage("Please select at least two nodes to add a line.");
        return;
    }
    // Pre-fill the input fields in the dialog based on selected nodes if desired
    // For now, just show the dialog.
    myAddLineDialog.style.display = 'block';
}

function myAddLineWithFact() {
    const myJoiningFact = myJoiningFactInput.value;
    if (mySelectedNodes.length < 2) {
        myShowMessage("Please select at least two nodes.");
        return;
    }
    const mySourceNode = mySelectedNodes[0];
    const myTargetNodes = mySelectedNodes.slice(1);
    for (const myTargetNode of myTargetNodes) {
        if (mySourceNode.id === myTargetNode.id) continue;
        const myExistingLink = myArbitraryLinks.find(
            link => (link.sourceId === mySourceNode.id && link.targetId === myTargetNode.id) ||
                (link.sourceId === myTargetNode.id && link.targetId === mySourceNode.id)
        );
        if (myExistingLink) continue;
        myArbitraryLinks.push({
            sourceId: mySourceNode.id,
            targetId: myTargetNode.id,
            joiningFact: myJoiningFact
        });
    }
    myUpdate(myRootNode);
    myAddLineDialog.style.display = 'none';
    myJoiningFactInput.value = '';
    myUnselectAllNodes();
    myShowMessage(`Added a new line.${myJoiningFact ? ` with fact: "${myJoiningFact}"` : ""}`);
}

function myCancelAddLine() {
    myAddLineDialog.style.display = 'none';
    myUnselectAllNodes();
    myShowMessage("Add line cancelled.");
}

function myLoadFile(event) {
    const myFile = event.target.files[0];
    if (!myFile) {
        return;
    }
    const myReader = new FileReader();
    myReader.onload = function(e) {
        try {
            const myJsonContent = JSON.parse(e.target.result);
            d3.select("#mySvgContainer g").selectAll("*").remove();
            myDrawData(myJsonContent);
            myShowMessage("File loaded successfully!");
        } catch (error) {
            myShowMessage("Error loading file. Please ensure it is a valid JSON file.");
        }
    };
    myReader.readAsText(myFile);
}

function mySaveData() {
    const mySavedNodes = myRootNode.descendants().map(d => {
        return {
            id: d.id,
            parentId: d.parent ? d.parent.id : "",
            name: d.data.name,
            fact: d.data.fact || "",
            x: d.x,
            y: d.y
        };
    });
    const myDataToSave = {
        nodes: mySavedNodes,
        links: myArbitraryLinks
    };
    const myJson = JSON.stringify(myDataToSave, null, 2);
    // This line will print the formatted JSON string to the browser's console.
    console.log(myJson);

    const myBlob = new Blob([myJson], { type: "application/json" });
    const myUrl = URL.createObjectURL(myBlob);
    const myLink = document.createElement("a");
    myLink.setAttribute("href", myUrl);
    myLink.setAttribute("download", "d3_graph_data.json");
    myLink.style.display = "none";
    document.body.appendChild(myLink);
    myLink.click();
    document.body.removeChild(myLink);
    URL.revokeObjectURL(myUrl);
    myDiv01.textContent = "JSON file saved successfully.";
}

/**
 * Starts the timer, resetting seconds and updating the status message every second.
 */
function startTimer() {
    seconds = 0;
    // Use the statusMessage area for the timer display
    if (statusMessage) {
        statusMessage.textContent = 'Thinking (0s)...';
    }
    timerInterval = setInterval(() => {
        seconds++;
        if (statusMessage) {
            statusMessage.textContent = `Thinking (${seconds}s)...`;
        }
    }, 1000);
}

/**
 * Stops the timer and clears the interval.
 */
function stopTimer() {
    clearInterval(timerInterval);
}

// --- Content Retrieval Functions (Injected into the Active Tab) ---

/**
 * This function is injected to get all visible text from the page body.
 * @returns {string} The raw text content of the page.
 */
function getPageText() {
    // Only return visible text content
    return document.body.innerText;
}

/**
 * This function is injected to get only the selected text.
 * @returns {string} The selected text.
 */
function getSelectedText() {
    return window.getSelection().toString();
}

// --- AI Summarization Core Function ---

/**
 * Uses the Chrome LanguageModel API to generate a structured, sectional summary of the input text.
 * @param {string} text - The text to summarize.
 * @returns {Promise<string>} The raw JSON string output from the model, or an error message.
 */
async function summarizeWithPrompt(text) {
    if ('LanguageModel' in window) {
        try {
            // Define the JSON schema for the required output format, now including 'sections' with subheadings.
            const summarySchema = {
                "type": "object",
                "properties": {
                    "heading": {
                        "type": "string",
                        "description": "A brief, descriptive title for the summary."
                    },
                    "sections": {
                        "type": "array",
                        "description": "A list of 2-4 sections, each with a descriptive subheading and detailed summary content.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "subheading": {
                                    "type": "string",
                                    "description": "A concise subheading for this specific section of the summary."
                                },
                                "content": {
                                    "type": "string",
                                    "description": "The detailed, neutral summary content for this section."
                                }
                            },
                            "required": ["subheading", "content"]
                        }
                    }
                },
                "required": ["heading", "sections"], // Both are now required
                "additionalProperties": false
            };

            // FIX: Specify the expected output language ('en') to satisfy new API safety warnings.
            const model = await LanguageModel.create({
                expectedOutputs: [
                    { type: "text", languages: ["en"] }
                ]
            });

            // Update the prompt to explicitly request the structured, sectional summary in JSON format.
            // MODIFICATION: Emphasize the JSON output format in the prompt.
            const prompt = `Provide a main title (heading) and a detailed summary of the following text, broken down into 2-4 key sections with descriptive subheadings. **The entire output must be a valid JSON object matching the requested schema. DO NOT include any explanatory text or formatting outside of the JSON object.** The text to summarize is:\n\n${text}`;

            // Pass the schema in the options for structured output.
            const summaryJsonString = await model.prompt(prompt, {
                responseConstraint: summarySchema
            });

            // Return the raw JSON string. The calling function will handle parsing and formatting.
            return summaryJsonString;
        } catch (error) {
            console.error('Error using LanguageModel API:', error);
            return `Error: ${error.message}. Please ensure the Chrome LanguageModel API is enabled/supported.`;
        }
    } else {
        return 'Error: The Chrome LanguageModel API is not supported in this browser or is not enabled.';
    }
}

// --- Action Handlers ---

/**
 * Grabs and summarizes the text from the webpage (either all or selected).
 * @param {function} extractionFunc - The content script function to execute (getPageText or getSelectedText).
 */
async function summarizePage(extractionFunc) {
    // Clear previous output and start loading state
    if (contentArea) contentArea.value = '';
    if (statusMessage) statusMessage.textContent = '';
    startTimer();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check for a valid URL
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('file://')) {
        stopTimer();
        if (statusMessage) statusMessage.textContent = 'Error: Cannot access content on this type of page (e.g., settings, extension page).';
        return;
    }

    try {
        // Execute the appropriate content retrieval function
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractionFunc
        });

        const extractedText = results[0].result;

        if (extractedText && extractedText.trim().length > 0) {
            if (statusMessage) statusMessage.textContent = 'Text extracted successfully. Generating summary...';

            const summaryJsonString = await summarizeWithPrompt(extractedText);
            stopTimer();

            try {
                const summaryObject = JSON.parse(summaryJsonString);

                // Start with the main heading
                let formattedOutput = (summaryObject.heading || 'Summary Title').toUpperCase() + '\n' + '='.repeat(40) + '\n\n';

                // Iterate through the sections and format them
                if (summaryObject.sections && Array.isArray(summaryObject.sections)) {
                    summaryObject.sections.forEach(section => {
                        // Use a simple text divider for subheadings
                        formattedOutput += `--- ${section.subheading.toUpperCase()} ---\n`;
                        formattedOutput += `${section.content}\n\n`;
                    });
                }

                if (contentArea) contentArea.value = formattedOutput.trim();
                if (statusMessage) statusMessage.textContent = 'Summary complete.';

            } catch (parseError) {
                // Fallback: If parsing fails, display the raw text and an error
                if (contentArea) contentArea.value = `ERROR: Failed to parse structured output. Displaying raw model output:\n\n${summaryJsonString}`;
                if (statusMessage) statusMessage.textContent = `Summary complete, but structured output parsing failed.`;
                console.error('Failed to parse summary JSON:', parseError, summaryJsonString);
            }

        } else {
            stopTimer();
            if (contentArea) contentArea.value = '';
            if (statusMessage) statusMessage.textContent = extractionFunc === getPageText ?
                'Could not retrieve any text from the page.' :
                'No text was selected on the page.';
        }
    } catch (error) {
        stopTimer();
        console.error('Scripting Error:', error);
        if (statusMessage) statusMessage.textContent = `Scripting Error: Could not execute script on the page.`;
    }
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', () => {
    myWidth = window.innerWidth - 40;
    myHeight = 600;
    myZoomBehavior = d3.zoom().on("zoom", myZoomed);
    mySvg = d3.select("#mySvgContainer")
        .attr("width", myWidth)
        .attr("height", myHeight)
        .call(myZoomBehavior)
        .append("g");
    mySvg.on("click", myUnselectAllNodes);
    myTreeLayout = d3.tree()
        .size([myWidth, myHeight - 75]);
    myDrawData(myDefaultData);
    myMakeDraggable("myFactDialog", ".my-movable-dialog-header2");
    myMakeDraggable("myAddNodeDialog", ".my-movable-dialog-header");
    myMakeDraggable("myAddLineDialog", ".my-movable-dialog-header");
    myMakeDraggable("myEditNodeDialog", ".my-movable-dialog-header"); // Make edit dialog draggable too

    // Update default prompt in myInputPrompt
    // This provides a clearer instruction for the user that the graph generation prompt
    // will now dynamically incorporate the contentArea's text.
    myInputPrompt.value = `Based on the following text, generate a single JSON object. The object must contain two top-level keys: "nodes" and "links". The "nodes" value must be an array of objects, each with "id" (a unique ordered number), "parentId" (a string corresponding to its parent's id, or an empty string for the root node which in this case will have the name of the main subject from the provided text), "name" (a descriptive string), and "fact" (a string containing a brief interesting fact about the node). The "links" value must be an empty array []. Do not include any text outside of the JSON object.`;


    // Summarizer Buttons
    const showAllBtn = document.getElementById('showAllBtn');
    const showSelectedBtn = document.getElementById('showSelectedBtn');

    if (showAllBtn) {
        showAllBtn.addEventListener('click', () => summarizePage(getPageText));
    }
    if (showSelectedBtn) {
        showSelectedBtn.addEventListener('click', () => summarizePage(getSelectedText));
    }
    if (statusMessage) {
        statusMessage.textContent = 'Click a button to summarize content.';
    }

    // Gemini Nano / D3.js Graph Buttons
    if (myLoadButton) myLoadButton.addEventListener('click', myLoadModel);
    if (myStreamButton) myStreamButton.addEventListener('click', myToggleStream);
    if (mySaveButton) mySaveButton.addEventListener('click', mySaveJSONFile);

    // D3 Graph Management Buttons
    if (myLoadD3Button) {
        myLoadD3Button.addEventListener('click', () => myFileLoadInput.click()); // Trigger click on hidden file input
    }
    if (myFileLoadInput) myFileLoadInput.addEventListener('change', myLoadFile); // Actual file load event

    if (mySaveD3Button) mySaveD3Button.addEventListener('click', mySaveData);
    if (myAddD3Button) myAddD3Button.addEventListener('click', myShowAddNodeDialog); // Opens the add node dialog
    if (myEditButton) myEditButton.addEventListener('click', myEditNode); // Opens the edit node dialog
    if (myAddLineD3Button) myAddLineD3Button.addEventListener('click', myShowAddLineDialog); // Opens the add line dialog
    if (myDeleteD3Button) myDeleteD3Button.addEventListener('click', myDeleteSelectedNodes);
    if (myFitScreenD3Button) myFitScreenD3Button.addEventListener('click', myFitToScreen);
    if (myLayoutSelector) myLayoutSelector.addEventListener('change', myChangeLayout);

    // Add Node Dialog Buttons
    if (myGenerateNodeButton) myGenerateNodeButton.addEventListener('click', myAddGenerateNode);
    if (myAddNodeSaveButton) myAddNodeSaveButton.addEventListener('click', () => myAddNewNode(true)); // Pass true to close dialog
    if (myAddNodeCancelButton) myAddNodeCancelButton.addEventListener('click', myCancelAddNode);

    // Add Line Dialog Buttons
    if (myAddLineSaveButton) myAddLineSaveButton.addEventListener('click', myAddLineWithFact);
    if (myAddLineCancelButton) myAddLineCancelButton.addEventListener('click', myCancelAddLine);

    // Edit Node Dialog Buttons
    if (myEditNodeSaveButton) myEditNodeSaveButton.addEventListener('click', mySaveEditedNode);
    if (myEditNodeCancelButton) myEditNodeCancelButton.addEventListener('click', myCancelEditNode);
});