javascript: (function() {
    var repo = "https://github.com/henriquemor/draw-bookmarklet";
    var author = "Henrique Moraes";
    var version = "8.8";
    var license = "MIT - 2023";
    var cw = author + version + license + repo;

    var canvas = document.getElementById("draw-on-page-canvas");
    if (canvas) {
        canvas.parentNode.removeChild(canvas);
        var ctrdv = document.getElementById("controls-div");
        ctrdv.parentNode.removeChild(ctrdv);
        return;
    }
    canvas = document.createElement("canvas");
    canvas.id = "draw-on-page-canvas";
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.border = "2px solid rgba(255, 255, 0, 0.3)";
    var dpr = window.devicePixelRatio || 2;
    canvas.width = (window.innerWidth - 20) * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = (window.innerWidth - 20) + "px";
    canvas.style.height = window.innerHeight + "px";
    canvas.style.zIndex = "9998";
    var context = canvas.getContext("2d");
    context.scale(dpr, dpr);
    context.strokeStyle = "#FFAB01";
    var baseStroke = 1.5;
    context.lineWidth = baseStroke;
    context.lineCap = "round";
    context.lineJoin = "round";
    document.body.appendChild(canvas);
    var isDrawing = false;
    var lastX;
    var lastY;
    var undoStack = [];

    if (localStorage.getItem("canvasDrawing") && false) {
        var dataURL = localStorage.getItem("canvasDrawing");
        var img = new Image();
        img.src = dataURL;

        context.drawImage(img, 0, 0);
    }



    var controlsdiv = document.createElement("div");
    controlsdiv.id = "controls-div";
    controlsdiv.style.zIndex = "9999";
    controlsdiv.style.fontSize = "12px";

    document.body.appendChild(controlsdiv);

    function ramerDouglasPeucker(points, epsilon) {
        if (points.length <= 2) {
            return points;
        }

        var maxDistance = 0;
        var maxIndex = 0;

        for (var i = 1; i < points.length - 1; i++) {
            var distance = pointLineDistance(points[i], points[0], points[points.length - 1]);

            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }

        if (maxDistance > epsilon) {
            var left = ramerDouglasPeucker(points.slice(0, maxIndex + 1), epsilon);
            var right = ramerDouglasPeucker(points.slice(maxIndex), epsilon);

            return left.slice(0, -1).concat(right);
        } else {
            return [points[0], points[points.length - 1]];
        }
    }

    function pointLineDistance(point, lineStart, lineEnd) {
        var lineLength = Math.sqrt((lineEnd.x - lineStart.x) ** 2 + (lineEnd.y - lineStart.y) ** 2);

        if (lineLength === 0) {
            return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
        }

        var t = ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) + (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) / (lineLength ** 2);

        t = Math.max(0, Math.min(1, t));

        var projX = lineStart.x + t * (lineEnd.x - lineStart.x);
        var projY = lineStart.y + t * (lineEnd.y - lineStart.y);

        return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
    }

    var points = [];
    var errorCorrection = 1;
    var highlighterMultiplier = 1;
    var pointerType = "";


    function normalize(value, min, max, newMin, newMax) {
        return ((value - min) / (max - min)) * (newMax - newMin) + newMin;
    }
    const average = array => array.reduce((a, b) => a + b) / array.length;

    function drawSmoothLine(points) {
        var simplifiedPoints = ramerDouglasPeucker(points, errorCorrection);


        for (var i = 0; i < simplifiedPoints.length - 1; i++) {
            var p0 = i > 0 ? simplifiedPoints[i - 1] : simplifiedPoints[i];
            var p1 = simplifiedPoints[i];
            var p2 = simplifiedPoints[i + 1];
            var p3 = i < simplifiedPoints.length - 2 ? simplifiedPoints[i + 2] : p2;

            var cp1x = p1.x + (p2.x - p0.x) / 6;
            var cp1y = p1.y + (p2.y - p0.y) / 6;
            var cp2x = p2.x - (p3.x - p1.x) / 6;
            var cp2y = p2.y - (p3.y - p1.y) / 6;

            context.beginPath();
            context.moveTo(p1.x, p1.y);

            if (penStyleInk) {
                var strokeWidth = (Math.min(p0.pressure, p1.pressure, p2.pressure, p3.pressure) + average([p0.pressure, p1.pressure, p2.pressure, p3.pressure])) / 2 * baseStroke;
                context.lineWidth = normalize(strokeWidth, 0, 1, baseStroke * 0.5, baseStroke * 3 * highlighterMultiplier);
            } else {
                var strokeWidth = baseStroke * highlighterMultiplier;
                context.lineWidth = strokeWidth;
            }


            context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            context.stroke();

        }
    }



    function draw(e) {
        if (!isDrawing) {
            return
        }
        e.preventDefault();
        var x, y, pressure;
        if (e.changedTouches) {
            x = e.changedTouches[0].pageX - canvas.offsetLeft;
            y = e.changedTouches[0].pageY - canvas.offsetTop - window.pageYOffset;
            pressure = e.changedTouches[0].force || 0.5;
        } else {
            x = e.pageX - canvas.offsetLeft;
            y = e.pageY - canvas.offsetTop - window.pageYOffset;
            pressure = e.pointerType === 'pen' && e.pressure ? e.pressure : 0.5;
        }
        points.push({
            x: x,
            y: y,
            pressure: pressure
        });


        context.putImageData(undoStack[undoStack.length - 1], 0, 0);

        drawSmoothLine(points);
    }



    function startDrawing(e) {
        isDrawing = true;
        lastX = e.pageX - canvas.offsetLeft;
        lastY = e.pageY - canvas.offsetTop - window.pageYOffset;
        undoStack.push(context.getImageData(0, 0, canvas.width, canvas.height));
        undoStack = undoStack.slice(-20);
    }

    function startTouchDrawing(e) {
        isDrawing = true;
        lastX = e.changedTouches[0].pageX - canvas.offsetLeft;
        lastY = e.changedTouches[0].pageY - canvas.offsetTop - window.pageYOffset;
        undoStack.push(context.getImageData(0, 0, canvas.width, canvas.height));
        undoStack = undoStack.slice(-20);
    }
    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("touchstart", startTouchDrawing);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("touchmove", function(e) {
        if (palmRejection && pointerType == 'touch') {
            canvas.style.pointerEvents = "none";
        } else {
            draw(e);
        }
    });
    canvas.addEventListener("pointerdown", function(e) {
        if (palmRejection && e.pointerType == 'touch') {
            canvas.style.pointerEvents = "none";
        }
    });
    canvas.addEventListener("mouseup", function() {
        isDrawing = false;
        points = [];

        var dataURL = canvas.toDataURL();
        localStorage.setItem("canvasDrawing", dataURL);
    });
    canvas.addEventListener("touchend", function() {
        isDrawing = false;
        points = [];

        var dataURL = canvas.toDataURL();
        localStorage.setItem("canvasDrawing", dataURL);

        function enableLoop() {
            if (canvas.style.pointerEvents == "auto") {
                console.log("Loop stopped");
                return;
            }
            canvas.style.pointerEvents = "none";
          setTimeout(() => {
            canvas.style.pointerEvents = "auto";
            enableLoop();
        }, 110);
            canvas.style.pointerEvents = "auto";
            setTimeout(enableLoop, 103);
            
        };
        setTimeout(() => {
            canvas.style.pointerEvents = "auto";
            enableLoop();
        }, "1000");


    });

    canvas.addEventListener('pointermove', function(event) {
        pressure = event.pressure;
        pointerType = event.pointerType;
    });








    function createButton(textOn, textOff, status, top, action) {
        var button = document.createElement("button");
        var text = status ? textOn : textOff;
        button.textContent = text;
        button.style.position = "fixed";
        button.style.top = top;
        button.style.right = "20px";
        button.style.zIndex = "9999";
        controlsdiv.appendChild(button);
        button.addEventListener("click", action);
        return button;
    }

    var eraserActive = false;
    var eraserBtn = createButton("erasing (active)", "erase", eraserActive, "70px", function() {
        if (eraserActive) {
            eraserBtn.textContent = "erase";
            context.globalCompositeOperation = 'source-over';
            eraserActive = false;
        } else {
            eraserActive = true;
            eraserBtn.textContent = "erasing (active)";
            context.globalCompositeOperation = 'destination-out';
        }
    });

    var undoBtn = createButton("undo", "", true, "105px", function() {
        if (undoStack.length > 1) {
            undoStack.pop();
            context.putImageData(undoStack[undoStack.length - 1], 0, 0);
        } else {
            context.clearRect(0, 0, canvas.width, canvas.height);
            undoStack.pop();
        }
    });

    var penStyleInk = true;
    var pressureBtn = createButton("🖍", "🖌", penStyleInk, "140px", function() {
        if (penStyleInk) {
            pressureBtn.textContent = "🖌";
            penStyleInk = false;
        } else {
            penStyleInk = true;
            pressureBtn.textContent = "🖍";
        }
    });
    var palmRejection = false;
    var palmBtn = createButton("use hands", "reject palm", palmRejection, "170px", function() {
        if (palmRejection) {
            palmBtn.textContent = "reject palm";
            palmRejection = false;
        } else {
            palmRejection = true;
            palmBtn.textContent = "use hands";
        }
    });
    var clearBtn = createButton("clear", "", true, "220px", function() {
        context.clearRect(0, 0, canvas.width, canvas.height);
        points = [];
        undoStack = [];
    });

    var disableActive = false;
    var disableBtn = createButton("activate (disabled)", "disable", disableActive, "250px", function() {
        if (disableActive) {
            disableBtn.textContent = "disable";
            canvas.style.pointerEvents = "auto";
            disableActive = false;
        } else {
            disableActive = true;
            disableBtn.textContent = "activate (disabled)";
            canvas.style.pointerEvents = "none";
        }
    });




    var colors = ["black", "#02498c", "#FFAB01", "#5bc936", "#ef3228", "white"];
    colors.forEach(function(color, index) {
        var colorBtn = document.createElement("button");
        colorBtn.style.backgroundColor = color;
        colorBtn.style.width = "20px";
        colorBtn.style.height = "20px";
        colorBtn.style.borderRadius = "5%";
        colorBtn.style.position = "fixed";
        colorBtn.style.top = "10px";
        colorBtn.style.right = 20 + index * 22 + "px";
        colorBtn.style.zIndex = "9999";
        controlsdiv.appendChild(colorBtn);

        colorBtn.addEventListener("click", function() {
            context.strokeStyle = color;
            highlighterMultiplier = 1;
            context.globalCompositeOperation = 'source-over';
        });
    });
    var highlights = ["rgba(245, 232, 39, 0.1)"];
    highlights.forEach(function(color, index) {
        var highlightBtn = document.createElement("button");
        highlightBtn.style.backgroundColor = color;
        highlightBtn.style.width = "20px";
        highlightBtn.style.height = "20px";
        highlightBtn.style.borderRadius = "5%";
        highlightBtn.style.position = "fixed";
        highlightBtn.style.top = "30px";
        highlightBtn.style.right = 20 + index * 22 + "px";
        highlightBtn.style.zIndex = "9999";
        controlsdiv.appendChild(highlightBtn);

        highlightBtn.addEventListener("click", function() {
            context.strokeStyle = color;
            highlighterMultiplier = 20;
            context.globalCompositeOperation = 'multiply';
        });
    });

    var colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = "#02498c";
    colorPicker.style.zIndex = "9999";
    colorPicker.style.position = "fixed";
    colorPicker.style.top = "10px";
    colorPicker.style.right = 150 + "px";
    controlsdiv.appendChild(colorPicker);
    colorPicker.addEventListener("change", function() {
        context.strokeStyle = colorPicker.value;
    });





    var slider = document.createElement("input");
    slider.type = "range";
    slider.min = "1";
    slider.max = "10";
    slider.value = baseStroke;
    slider.style.position = "fixed";
    slider.style.top = "50px";
    slider.style.right = "20px";
    slider.style.zIndex = "9999";
    slider.style.width = "100px";
    controlsdiv.appendChild(slider);
    slider.addEventListener("input", function() {
        baseStroke = slider.value;
        context.lineWidth = baseStroke;
        console.info(context.lineWidth);
    });


})();
