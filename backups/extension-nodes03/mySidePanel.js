/* Gemini AI (LanguageModel) & D3.js - Global variables */
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

let mySvg, myWidth, myHeight;
let myTreeLayout;
let myRootNode;
let myArbitraryLinks = [];
let myIsDragging = false;
let mySelectedNodes = [];
let myZoomBehavior;
// Assuming D3.js (d3) is available globally
const myLineGenerator = d3.line().x(d => d.x).y(d => d.y); 

const myDefaultData = {
    nodes: [
        { id: "1", parentId: "", name: "Root Node", fact: "Start your knowledge map here." },
        { id: "2", parentId: "1", name: "Concept 1", fact: "The first major idea." },
        { id: "3", parentId: "1", name: "Concept 2", fact: "A parallel concept." },
        { id: "4", parentId: "2", name: "Detail A", fact: "A specific fact under Concept 1." }
    ],
    links: []
};


// ===============================================
// CORE INITIALIZATION & UTILITIES
// ===============================================

window.onload = function() {
    // 1. Initial Setup
    myWidth = document.getElementById('mySvgContainer').offsetWidth || 300; 
    myHeight = 300;

    myZoomBehavior = d3.zoom().on("zoom", myZoomed);
    mySvg = d3.select("#mySvgContainer")
        .attr("width", myWidth)
        .attr("height", myHeight)
        .call(myZoomBehavior)
        .append("g");
        
    mySvg.on("click", myUnselectAllNodes);

    // Initial layout setup
    myTreeLayout = d3.tree().size([myWidth, myHeight - 75]);
    myDrawData(myDefaultData);

    // 2. Programmatically Attach Event Listeners (CSP-Compliant)
    myAttachEventListeners();

    // 3. Make dialogs draggable within the side panel
    myMakeDraggable("myAddNodeDialog", "#myAddNodeDialogHeader");
    myMakeDraggable("myAddLineDialog", "#myAddLineDialogHeader");
    myMakeDraggable("myEditNodeDialog", "#myEditNodeDialogHeader");
};


function myAttachEventListeners() {
    // Top Controls
    myLoadButton.addEventListener('click', myLoadModel);
    myStreamButton.addEventListener('click', myToggleStream);
    mySaveButton.addEventListener('click', mySaveJSONFile);
    
    // NEW CONTENT GRAB BUTTONS
    document.getElementById('myGrabPageTextButton').addEventListener('click', () => myExtractContent('getPageText'));
    document.getElementById('myGrabSelectedTextButton').addEventListener('click', () => myExtractContent('getSelectedText'));

    // D3 Controls
    document.getElementById('myLoadFileButton').addEventListener('click', () => document.getElementById('myFileLoad').click());
    document.getElementById('myFileLoad').addEventListener('change', myLoadFile);
    document.getElementById('mySaveDataButton').addEventListener('click', mySaveData);
    document.getElementById('myShowAddNodeButton').addEventListener('click', myShowAddNodeDialog);
    document.getElementById('myEditNodeButton').addEventListener('click', myEditNode);
    document.getElementById('myShowAddLineButton').addEventListener('click', myShowAddLineDialog);
    document.getElementById('myDeleteSelectedButton').addEventListener('click', myDeleteSelectedNodes);
    document.getElementById('myFitToScreenButton').addEventListener('click', myFitToScreen);
    document.getElementById('myLayoutSelector').addEventListener('change', myChangeLayout);

    // Add Node Dialog Controls
    document.getElementById('myAddGenerateNodeButton').addEventListener('click', myAddGenerateNode);
    document.getElementById('myAddNewNodeButton').addEventListener('click', myAddNewNode);
    document.getElementById('myCancelAddNodeButton').addEventListener('click', () => document.getElementById('myAddNodeDialog').style.display = 'none');

    // Add Line Dialog Controls
    document.getElementById('myAddLineWithFactButton').addEventListener('click', myAddLineWithFact);
    document.getElementById('myCancelAddLineButton').addEventListener('click', () => document.getElementById('myAddLineDialog').style.display = 'none');

    // Edit Node Dialog Controls
    document.getElementById('mySaveEditedNodeButton').addEventListener('click', mySaveEditedNode);
    document.getElementById('myCancelEditNodeButton').addEventListener('click', () => { 
        document.getElementById('myEditNodeDialog').style.display = 'none'; 
        myUnselectAllNodes();
    });
}

/**
 * Sends a message to the Service Worker (or active tab) to request content extraction.
 * The Service Worker must be set up to receive this and execute a content script.
 * @param {string} myMethod 'getPageText' or 'getSelectedText'
 */
async function myExtractContent(myMethod) {
    myShowMessage(`Requesting ${myMethod === 'getPageText' ? 'full page' : 'selected'} text...`);
    try {
        const [myTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (myTab && myTab.id) {
            // Send a message to the active tab's content script (or service worker)
            // The service worker needs to be set up to relay this to a content script.
            const response = await chrome.tabs.sendMessage(myTab.id, { 
                action: 'extractContent', 
                method: myMethod 
            });

            // The content script or service worker *should* return a confirmation,
            // but the actual text is usually returned via a separate runtime.onMessage listener
            // which calls mySetInputPromptFromExternalSource.
        }
    } catch (error) {
        console.error('Error sending message:', error);
        myShowMessage(`Error: Could not communicate with the page. ${error.message.includes('Receiving end closed') ? 'Ensure you have a content script running.' : error.message}`);
    }
}

/**
 * Public function to receive text from the extension's background script.
 * Call this from your chrome.runtime.onMessage listener.
 * @param {string} myContent The text content to set as the prompt.
 * @param {string} mySource 'selection' or 'fullPage' for context.
 */
function mySetInputPromptFromExternalSource(myContent, mySource) {
    if (myContent.length > 0) {
        // Suggested prompt template for knowledge extraction
        let promptTemplate = `Generate a single JSON object summarizing the key topics and subtopics from the text below: \n"${myContent.substring(0, 2000)}". The object must contain two top-level keys: "nodes" and "links". The "nodes" value must be an array of objects, each with "id" (a unique ordered number, starting from 1), "parentId" (a string corresponding to its parent's id, or an empty string for the root node, which should be named "Root"), "name" (a descriptive string), and "fact" (a string containing a brief interesting fact about the node). The "links" value must be an empty array []. Do not include any text outside of the JSON object.`;
        
        myInputPrompt.value = promptTemplate;
        myShowMessage(`Received ${mySource} content. Ready to generate graph.`);
    } else {
        myInputPrompt.value = '';
        myShowMessage(`No content found in ${mySource}.`);
    }
}

function myMakeDraggable(dialogId, headerSelector) {
    const myDialog = document.getElementById(dialogId);
    if (!myDialog) return;
    const myHeader = document.querySelector(headerSelector);
    if (!myHeader) return;
    
    myHeader.addEventListener('mousedown', (e) => {
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
    });
}

function myZoomed(event) {
    mySvg.attr("transform", event.transform);
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

function myShowMessage(message) {
    // Append message to the show div
    const showDiv = document.getElementById("myShowDiv");
    showDiv.textContent = message; 

    // Clear the message after 5 seconds
    setTimeout(() => {
        showDiv.textContent = '';
    }, 5000); 
}


// ===============================================
// AI (LanguageModel API) FUNCTIONS
// ===============================================

async function myLoadModel() {
    if (myIsProcessing) return;
    myDiv01.textContent = 'Loading AI model...';
    try {
        myIsProcessing = true;
        // Uses the chrome built-in LanguageModel API
        if (typeof LanguageModel === 'undefined') {
            myDiv01.textContent = 'Error: LanguageModel API is not available.';
            return;
        }
        mySession = await LanguageModel.create();
        myDiv01.textContent = 'AI model loaded successfully. Ready to generate graph.';
        myLoadButton.disabled = true;
    } catch (myError) {
        myDiv01.textContent = `Error loading AI model: ${myError.message}`;
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
    const myPrompt = myInputPrompt.value.trim();
    if (!mySession) {
        myOutput.value = 'Please load the AI model first.';
        myDiv01.textContent = '...';
        return;
    }
    if (!myPrompt) {
        myOutput.value = 'Please enter a prompt.';
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
        const myStream = await mySession.promptStreaming(myPrompt, {
            signal: myController.signal,
            outputLanguage: 'en'
        });
        for await (const myChunk of myStream) {
            myLastGeneratedText += myChunk;
            myOutput.value = myLastGeneratedText;
            myOutput.scrollTop = myOutput.scrollHeight;
        }

        // Process the final output
        const myStartIndex = myLastGeneratedText.indexOf('{');
        const myEndIndex = myLastGeneratedText.lastIndexOf('}');
        if (myStartIndex !== -1 && myEndIndex !== -1) {
            const mySanitizedText = myLastGeneratedText.substring(myStartIndex, myEndIndex + 1);
            try {
                const myGeneratedJSON = JSON.parse(mySanitizedText);
                
                // Sanitize IDs to ensure they are strings
                const mySanitizedNodes = myGeneratedJSON.nodes.map(node => {
                    node.id = String(node.id);
                    if (node.parentId !== null && node.parentId !== undefined) {
                        node.parentId = String(node.parentId);
                    }
                    return node;
                });
                
                const mySanitizedJSONData = {
                    nodes: mySanitizedNodes,
                    links: myGeneratedJSON.links || []
                };

                // Clear and draw new data
                d3.select("#mySvgContainer g").selectAll("*").remove();
                myDrawData(mySanitizedJSONData); 
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
        const myCharsPerSecond = myDurationSeconds > 0 ? (myCharCount / myDurationSeconds).toFixed(2) : '0.00';
        
        myDiv01.innerHTML = `Completed in ${myDurationSeconds.toFixed(2)}s. Chars/s: ${myCharsPerSecond}`;
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
        myLink.download = 'ai_output.json';
        document.body.appendChild(myLink);
        myLink.click();
        document.body.removeChild(myLink);
        URL.revokeObjectURL(myUrl);
        myDiv01.textContent = 'Raw JSON file saved successfully.';
    } catch (e) {
        myDiv01.textContent = `Error: The sanitized output is not valid JSON. Details: ${e.message}`;
    }
}


// ===============================================
// D3.JS GRAPH MANIPULATION FUNCTIONS (Provided by user)
// ===============================================

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
            // Radial conversion
            d.x = d.y * Math.cos(d.x - Math.PI / 2);
            d.y = d.y * Math.sin(d.x - Math.PI / 2);
        });
    } else if (layoutType === 'cluster') {
        myTreeLayout = d3.cluster().size([myWidth, myHeight - 75]);
        myTreeLayout(myRootNode);
    } else if (layoutType === 'personal') {
        myCustomLayout();
    }
    
    // Smoothly transition all nodes to the new layout positions
    myRootNode.descendants().forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
    });

    myUpdate(myRootNode);
    myShowMessage(`Graph layout has been reset to ${layoutType}.`);
}

function myChangeLayout() {
    const layoutType = document.getElementById('myLayoutSelector').value;
    myTidyUpGraph(layoutType);
}

// Placeholder for custom layout function if needed
function myCustomLayout() {
    // If layout is 'personal', we keep the manually dragged positions
    // but we can adjust them slightly for visual appeal if needed
    // For now, this simply prevents the standard D3 layout from running
    myRootNode.descendants().forEach(d => {
        d.x = d.x; 
        d.y = d.y; 
    });
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
        const currentX = box.x === Infinity ? b.x : Math.min(box.x, b.x);
        const currentY = box.y === Infinity ? b.y : Math.min(box.y, b.y);
        const currentWidth = box.width === -Infinity ? b.x + b.width : Math.max(box.width, b.x + b.width);
        const currentHeight = box.height === -Infinity ? b.y + b.height : Math.max(box.height, b.y + b.height);
        
        return {
            x: currentX,
            y: currentY,
            width: currentWidth, // Note: width and height here are Max X/Y values
            height: currentHeight
        };
    }, { x: Infinity, y: Infinity, width: -Infinity, height: -Infinity });

    const myGraphWidth = myCombinedBoundingBox.width - myCombinedBoundingBox.x;
    const myGraphHeight = myCombinedBoundingBox.height - myCombinedBoundingBox.y;

    // Use total SVG dimensions for scale calculation
    const svgElement = document.getElementById('mySvgContainer');
    const viewWidth = svgElement.clientWidth;
    const viewHeight = svgElement.clientHeight;

    const myScale = Math.min(viewWidth / myGraphWidth, viewHeight / myGraphHeight) * 0.9;
    
    const myCenterGraphX = myCombinedBoundingBox.x + myGraphWidth / 2;
    const myCenterGraphY = myCombinedBoundingBox.y + myGraphHeight / 2;

    const myTranslateX = (viewWidth / 2) - myCenterGraphX * myScale;
    const myTranslateY = (viewHeight / 2) - myCenterGraphY * myScale;

    d3.select("#mySvgContainer")
        .transition()
        .duration(750)
        .call(myZoomBehavior.transform, d3.zoomIdentity.translate(myTranslateX, myTranslateY).scale(myScale));
}

function findHighestIdNumber() {
    let maxId = 0;
    if (!myRootNode) return 0;
    const allNodes = myRootNode.descendants();
    
    allNodes.forEach(node => {
        // Regex to find one or more digits at the end of the string.
        const match = String(node.id).match(/\d+$/);
        
        if (match) {
            const idNumber = parseInt(match[0]);
            if (idNumber > maxId) {
                maxId = idNumber;
            }
        }
    });
    return maxId;
}

function myDrawData(data) {
    const myRawData = data.nodes;
    myArbitraryLinks = data.links;

    myRootNode = d3.stratify()
        .id(d => d.id.toString()) 
        .parentId(d => d.parentId)(myRawData);
    
    // Set the counter based on the data loaded
    myNodeIdCounter = findHighestIdNumber();
    console.log(`Highest existing ID found: ${myNodeIdCounter}`);

    // Apply the tree layout to get a starting point for all nodes
    myTreeLayout(myRootNode);

    // Now, iterate and restore positions from saved data, using the layout's values as a fallback
    myRootNode.descendants().forEach(d => {
        const myLoadedData = myRawData.find(item => String(item.id) === d.id);
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


function myValidateGraph() {
    if (!myRootNode) return;
    myRootNode.descendants().forEach(d => {
        // Ensure all coordinates are valid numbers
        if (isNaN(d.x) || d.x === undefined) d.x = 0;
        if (isNaN(d.y) || d.y === undefined) d.y = 0;
        if (isNaN(d.x0) || d.x0 === undefined) d.x0 = d.x;
        if (isNaN(d.y0) || d.y0 === undefined) d.y0 = d.y;
    });
}

function myUpdate(source) {
    myValidateGraph();
    let myColorScale = d3.scaleOrdinal(['#69a3b2', '#7dd95c', '#c7c7c7', '#2c3e50', '#f39c12', '#800080']);
    const myNodeData = myRootNode.descendants();
    const myTreeLinkData = myRootNode.links();
    const myNodesById = new Map(myNodeData.map(d => [d.id, d]));
    
    const myDragBehavior = d3.drag()
        .on("start", myDragStart)
        .on("drag", myDragged)
        .on("end", myDragEnd);
    
    // === Tree Links ===
    const myTreeLink = mySvg.selectAll(".link")
        .data(myTreeLinkData, d => d.target.id);
        
    myTreeLink.enter().append("path")
        .attr("class", "link")
        // Start new links from the source's old position
        .attr("d", d => myLineGenerator([source, d.target]))
        .merge(myTreeLink)
        .transition()
        .duration(500)
        .attr("d", d => myLineGenerator([d.source, d.target]));
        
    myTreeLink.exit().remove();
    
    // === Arbitrary Links (Non-Tree) ===
    const validArbitraryLinks = myArbitraryLinks.filter(d => myNodesById.has(d.sourceId) && myNodesById.has(d.targetId));
    
    // Path (Line)
    const myArbitraryLinkPath = mySvg.selectAll(".arbitrary-link")
        .data(validArbitraryLinks, d => `${d.sourceId}-${d.targetId}`);
        
    myArbitraryLinkPath.enter().append("path")
        .attr("class", "arbitrary-link")
        .attr("id", d => `path-${d.sourceId}-${d.targetId}`)
        .attr("d", d => myLineGenerator([myNodesById.get(d.sourceId), myNodesById.get(d.targetId)]))
        .merge(myArbitraryLinkPath)
        .attr("d", d => myLineGenerator([myNodesById.get(d.sourceId), myNodesById.get(d.targetId)]));
        
    // Text Label
    const myArbitraryLinkText = mySvg.selectAll(".line-text")
        .data(validArbitraryLinks, d => `text-${d.sourceId}-${d.targetId}`);
        
    myArbitraryLinkText.enter().append("text")
        .attr("class", "line-text")
        .merge(myArbitraryLinkText)
        .html(d => `<textPath href="#path-${d.sourceId}-${d.targetId}" startOffset="50%">${d.joiningFact}</textPath>`);
        
    myArbitraryLinkText.exit().remove();
    
    // === Nodes ===
    const myNode = mySvg.selectAll(".node")
        .data(myNodeData, d => d.id);
        
    const myNodeEnter = myNode.enter().append("g")
        .attr("class", "node")
        // Initial position from the source's old position
        .attr("transform", d => `translate(${source.x0},${source.y0})`)
        .on("click", myClickNode)
        .on("mouseover", (event, d) => {
            d3.select(event.currentTarget).select("circle").style("stroke", "cyan");
            if (d.data.fact) {
                document.getElementById("myShowDiv").textContent = d.data.fact;
            }
        })
        .on("mouseout", (event) => {
            // Restore stroke unless node is selected
            if (!d3.select(event.currentTarget).classed('selected')) {
                d3.select(event.currentTarget).select("circle").style("stroke", "steelblue");
            } else {
                 d3.select(event.currentTarget).select("circle").style("stroke", "crimson");
            }
        });
        
    myNodeEnter.append("circle")
        .attr("r", 10)
        .style("fill", d => d3.select(myNodeEnter.node().parentNode).classed('selected') ? 'crimson' : myColorScale(d.depth))
        .style("stroke", "steelblue")
        .style("stroke-width", "2px");
        
    myNodeEnter.append("text")
        .attr("dy", "0.31em")
        .attr("x", 15)
        .attr("text-anchor", "start")
        .text(d => d.data.name)
        .style("fill", "#2c3e50");
        
    const myNodeUpdate = myNodeEnter.merge(myNode);
    
    // Update text content and position for existing nodes
    myNodeUpdate.select("text")
        .attr("x", 15)
        .attr("text-anchor", "start")
        .text(d => d.data.name);
        
    // Apply new positions with transition
    myNodeUpdate.transition()
        .duration(500)
        .attr("transform", d => `translate(${d.x},${d.y})`);
        
    // Apply drag behavior
    myNodeUpdate.call(myDragBehavior);
    
    myNode.exit().remove();
    
    // Save current positions as old positions for next transition
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
    
    // Keep links updated during drag
    myUpdate(d); 
}

function myDragEnd(event, d) {
    myIsDragging = false;
    d3.select(this).classed("dragging", false);
    // Force a minor update to settle the links after drag
    myUpdate(d); 
    myShowMessage(d.data.fact || "No fact available for this node.");
}

function myClickNode(event, d) {
    event.stopPropagation();
    if (myIsDragging) return;
    
    const myCircle = d3.select(event.currentTarget).select("circle");
    const isSelected = d3.select(event.currentTarget).classed('selected');

    if (event.ctrlKey) {
        // Multi-select with Ctrl
        const myIndex = mySelectedNodes.indexOf(d);
        if (myIndex > -1) {
            mySelectedNodes.splice(myIndex, 1);
            d3.select(event.currentTarget).classed('selected', false);
            myCircle.style("fill", d3.scaleOrdinal(['#69a3b2', '#7dd95c', '#c7c7c7', '#2c3e50', '#f39c12', '#800080'])(d.depth));
            myCircle.style("stroke", "steelblue");
        } else {
            mySelectedNodes.push(d);
            d3.select(event.currentTarget).classed('selected', true);
            myCircle.style("fill", "crimson");
            myCircle.style("stroke", "crimson"); 
        }
    } else {
        // Single select
        myUnselectAllNodes();
        if (!isSelected) { // Select the clicked node if it wasn't already selected
            d3.select(event.currentTarget).classed('selected', true);
            myCircle.style("fill", "crimson");
            myCircle.style("stroke", "crimson");
            mySelectedNodes.push(d);
        } // If it was already selected, myUnselectAllNodes cleared it, leaving it unselected.
        
        if (d.data.fact) {
            // Fact is shown on mouseover, but keep this for consistency
        } else {
            myShowMessage("No fact available. Use **Ctrl** to select multiple nodes for adding a line.");
        }
    }
}

function myUnselectAllNodes() {
    d3.selectAll('.node.selected')
        .classed('selected', false)
        .each(function(d) {
            // Restore color based on depth
            const myColorScale = d3.scaleOrdinal(['#69a3b2', '#7dd95c', '#c7c7c7', '#2c3e50', '#f39c12', '#800080']);
            d3.select(this).select("circle").style("fill", myColorScale(d.depth)).style("stroke", "steelblue");
        });
    mySelectedNodes = [];
}

function myShowAddNodeDialog(shouldCloseDialog = true) {
    if (mySelectedNodes.length === 1) {
        document.getElementById('myNewNodeParentId').value = mySelectedNodes[0].id;
        document.getElementById('myNewNodeName').value = '';
        document.getElementById('myNewNodeFact').value = '';
        document.getElementById('myAddNodeDialog').style.display = 'block';
    } else if (mySelectedNodes.length === 0) {
        myShowMessage("Please select a single node to be the parent of the new node.");
    } else {
        myShowMessage("Please select ONLY one node to add a child node to.");
    }
}

function myEditNode() {
    if (mySelectedNodes.length !== 1) {
        myShowMessage("Please select exactly one node to edit.");
        return;
    }
    const myNodeToEdit = mySelectedNodes[0];
    document.getElementById('myEditNodeName').value = myNodeToEdit.data.name;
    document.getElementById('myEditNodeFact').value = myNodeToEdit.data.fact || '';
    document.getElementById('myEditNodeDialog').style.display = 'block';
}

function mySaveEditedNode() {
    if (mySelectedNodes.length !== 1) return;
    const myNodeToEdit = mySelectedNodes[0];
    
    myNodeToEdit.data.name = document.getElementById('myEditNodeName').value;
    myNodeToEdit.data.fact = document.getElementById('myEditNodeFact').value;

    // The logic below ensures that the name and fact updates are reflected in the hierarchy data.
    // If the node data is stored separately (not just in the d.data object), it should be updated there too.
    // In this D3 structure, d.data is the primary source, so updating it is sufficient.

    myUpdate(myRootNode); // Re-draw to reflect the new text
    document.getElementById('myEditNodeDialog').style.display = 'none';
    myUnselectAllNodes();
    myShowMessage(`Node "${myNodeToEdit.data.name}" updated.`);
}

function myDeleteSelectedNodes() {
    if (mySelectedNodes.length === 0) {
        myShowMessage("Please select one or more nodes to delete.");
        return;
    }

    const myNodesToDeleteIds = mySelectedNodes.map(d => d.id);
    let myRawData = myRootNode.descendants().map(d => d.data);
    let myLinks = myArbitraryLinks;

    // Filter nodes: keep only nodes whose ID is NOT in the delete list, and whose parentId is NOT in the delete list
    myRawData = myRawData.filter(d => 
        !myNodesToDeleteIds.includes(d.id) && !myNodesToDeleteIds.includes(d.parentId)
    );

    // Filter arbitrary links: remove links where either source or target is a deleted node
    myLinks = myLinks.filter(l => 
        !myNodesToDeleteIds.includes(l.sourceId) && !myNodesToDeleteIds.includes(l.targetId)
    );
    myArbitraryLinks = myLinks;

    try {
        // Rebuild the hierarchy
        myRootNode = d3.stratify()
            .id(d => d.id)
            .parentId(d => d.parentId)(myRawData);
    } catch (e) {
        // If the root node was deleted, the stratify might fail.
        // If the data becomes empty, fall back to default data structure
        if (myRawData.length === 0) {
            myDrawData(myDefaultData);
            myShowMessage("All nodes deleted. Resetting to default graph.");
            return;
        }
        myShowMessage("Error rebuilding graph after deletion. Check console for orphan nodes.");
        console.error(e);
        return;
    }
    
    // Apply layout and update
    myTreeLayout(myRootNode);
    myUpdate(myRootNode);
    mySelectedNodes = [];
    myShowMessage(`Deleted ${myNodesToDeleteIds.length} node(s) and their descendants.`);
}

function myAddNewNode(shouldCloseDialog = true) {
    myNodeIdCounter++;
    
    const myNewNodeName = document.getElementById('myNewNodeName').value;
    const myNewNodeParentId = document.getElementById('myNewNodeParentId').value;
    const myNewNodeFact = document.getElementById('myNewNodeFact').value;

    if (!myNewNodeName || !myNewNodeParentId) {
        myShowMessage("Node Name and Parent ID are required.");
        return;
    }
    
    const myRawData = myRootNode.descendants().map(d => d.data);
    const myNewNodeId = myNodeIdCounter.toString();
    
    const myNewDataPoint = {
        id: myNewNodeId,
        parentId: myNewNodeParentId,
        name: myNewNodeName,
        fact: myNewNodeFact || ""
    };
    
    myRawData.push(myNewDataPoint);

    // Save current positions to restore them later
    const myCurrentPositions = new Map(myRootNode.descendants().map(d => [d.id, { x: d.x, y: d.y }]));

    // Rebuild the D3 hierarchy with the new data
    myRootNode = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.parentId)(myRawData);
        
    // Apply the layout to get initial positions for all nodes, including the new one
    myTreeLayout(myRootNode);

    const myNewNode = myRootNode.descendants().find(d => d.id === myNewNodeId);
    const myParentNode = myRootNode.descendants().find(d => d.id === myNewNodeParentId);
    
    // Position the new node relative to its parent's CURRENT position (not layout position)
    const myParentCurrentPos = myCurrentPositions.get(myNewNodeParentId);

    if (myNewNode && myParentCurrentPos) {
        // Position the new node near its parent's current visual position
        myNewNode.x = myParentCurrentPos.x + (Math.random() * 200) - 100;
        myNewNode.y = myParentCurrentPos.y + 100;
        
        // Initialize x0 and y0 for the new node to start from the parent's current position
        myNewNode.x0 = myParentCurrentPos.x;
        myNewNode.y0 = myParentCurrentPos.y;
    }

    // Restore the old positions for all existing nodes for smooth transition
    myRootNode.descendants().forEach(d => {
        const oldPos = myCurrentPositions.get(d.id);
        if (oldPos && d.id !== myNewNodeId) {
            d.x = oldPos.x;
            d.y = oldPos.y;
        }
    });

    myUpdate(myRootNode);

    if (shouldCloseDialog) {
        document.getElementById('myAddNodeDialog').style.display = 'none';
        myUnselectAllNodes();
    }
    
    myShowMessage(`Added new node "${myNewNodeName}".`);
}

async function myAddGenerateNode() {
    const myParentId = document.getElementById('myNewNodeParentId').value;
    const myNameInput = document.getElementById('myNewNodeName');
    const myFactInput = document.getElementById('myNewNodeFact');
    const myLoops = document.getElementById('myGenerateLoopNumber').value;

    if (!mySession) {
        myShowMessage("Please load the AI model first.");
        return;
    }

    if (!myLoops || parseInt(myLoops) <= 0) {
        myShowMessage("Please enter a valid number of nodes to generate.");
        return;
    }

    const myParentNode = myRootNode.descendants().find(d => d.id === myParentId);
    if (!myParentNode) {
        myShowMessage("Parent node not found. Please select a node before generating.");
        return;
    }
    const myParentName = myParentNode.data.name;

    // Start the generation loop
    await myGenerateNodesLoop(myParentName, myParentId, myNameInput, myFactInput, parseInt(myLoops));

    // Close the dialog and reset the state only after the loop is complete
    document.getElementById('myAddNodeDialog').style.display = 'none';
    myUnselectAllNodes();
}

async function myGenerateNodesLoop(parentName, parentId, nameInput, factInput, numLoops) {
    const myParentNode = myRootNode.descendants().find(d => d.id === parentId);
    if (!myParentNode) return; 

    for (let i = 0; i < numLoops; i++) {
        let generatedName = '';
        
        // 1. Generate Node Name
        if (i === 0 && nameInput.value.trim() !== '') {
            generatedName = nameInput.value.trim();
        } else {
            nameInput.value = 'Generating name...';
            const namePrompt = `Generate a one or two word sub-concept for the term ${parentName}. Do not include any text other than the name.`;
            const nameStream = await mySession.promptStreaming(namePrompt, { signal: new AbortController().signal });
            for await (const chunk of nameStream) {
                generatedName += chunk;
            }
            generatedName = generatedName.trim();
            nameInput.value = generatedName;
        }

        // 2. Generate Fact
        factInput.value = 'Generating fact...';
        const factPrompt = `Generate one short, interesting, and concise fact about ${generatedName}. Do not include any text other than the fact itself.`;
        const factStream = await mySession.promptStreaming(factPrompt, { signal: new AbortController().signal });
        let generatedFact = '';
        for await (const chunk of factStream) {
            generatedFact += chunk;
        }
        generatedFact = generatedFact.trim();
        factInput.value = generatedFact;

        // 3. Add Node to Graph
        myNodeIdCounter++;
        const myNewNodeId = myNodeIdCounter.toString();
        const myRawData = myRootNode.descendants().map(d => d.data);

        myRawData.push({
            id: myNewNodeId,
            parentId: parentId,
            name: generatedName,
            fact: generatedFact || ""
        });
        
        // Save and restore positions for smoothness
        const myCurrentPositions = new Map(myRootNode.descendants().map(d => [d.id, { x: d.x, y: d.y }]));

        myRootNode = d3.stratify()
            .id(d => d.id)
            .parentId(d => d.parentId)(myRawData);
        
        myTreeLayout(myRootNode);

        // Position new node relative to parent's current position
        const myNewNode = myRootNode.descendants().find(d => d.id === myNewNodeId);
        const myParentCurrentPos = myCurrentPositions.get(parentId);

        if (myNewNode && myParentCurrentPos) {
            myNewNode.x = myParentCurrentPos.x + (Math.random() * 200) - 100;
            myNewNode.y = myParentCurrentPos.y + 100;
            myNewNode.x0 = myParentCurrentPos.x;
            myNewNode.y0 = myParentCurrentPos.y;
        }

        // Restore old positions for smooth transition
        myRootNode.descendants().forEach(d => {
            const oldPos = myCurrentPositions.get(d.id);
            if (oldPos && d.id !== myNewNodeId) {
                d.x = oldPos.x;
                d.y = oldPos.y;
            }
            // Ensure old positions are set for next update, if they weren't restored
            if (d.x0 === undefined) { d.x0 = d.x; d.y0 = d.y; }
        });
        
        myUpdate(myRootNode);

        if (i < numLoops - 1) {
            nameInput.value = '';
            factInput.value = '';
        }
    }
    myShowMessage(`Added ${numLoops} new node(s) to "${parentName}".`);
}

function myShowAddLineDialog() {
    if (mySelectedNodes.length < 2) {
        myShowMessage("Please select at least two nodes to add a line.");
        return;
    }
    document.getElementById('myAddLineDialog').style.display = 'block';
}

function myAddLineWithFact() {
    const myJoiningFact = document.getElementById('myJoiningFact').value;
    if (mySelectedNodes.length < 2) {
        myShowMessage("Please select at least two nodes.");
        return;
    }
    
    // The first selected node is the source, the rest are targets
    const mySourceNode = mySelectedNodes[0];
    const myTargetNodes = mySelectedNodes.slice(1);
    
    for (const myTargetNode of myTargetNodes) {
        if (mySourceNode.id === myTargetNode.id) continue;
        
        // Check for existing link (undirected)
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
    document.getElementById('myAddLineDialog').style.display = 'none';
    document.getElementById('myJoiningFact').value = '';
    myUnselectAllNodes();
    myShowMessage(`Added new line(s).${myJoiningFact ? ` with fact: "${myJoiningFact}"` : ""}`);
}

function myLoadFile(event) {
    const myFile = event.target.files[0];
    if (!myFile) {
        return;
    }
    const myReader = new FileReader();
    myReader.onload = async function(e) {
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
    myShowMessage("Graph data saved to d3_graph_data.json");
}