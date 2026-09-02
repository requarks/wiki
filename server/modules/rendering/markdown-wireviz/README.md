# WireViz Renderer

This provides a WireViz Markdown renderer plugin for Wiki.js, allowing you to embed WireViz diagrams directly in Wiki.js pages. Diagrams are rendered via a WireViz-Web server, either locally or remotely.


## Install

* Install https://github.com/wireviz/wireviz-web
* Start wireviz-web server
* Configure Wiki.js WireViz plugin
    * Set wirevizWebUrl to point to wireviz-web server URL
    * Enable WireViz plugin

## Test

Add this to your Markdown page

````markdown
```wireviz
connectors:
  X1:
    type: Molex 39-29-9042
    pinlabels: [GND, +12V]
  X2:
    type: Molex 39-29-9042
    pinlabels: [GND, +12V]

cables:
  W1:
    gauge: 18 AWG3
    length: 1.5
    color_code: DIN
    wirecount: 2
    shield: true

connections:
  -
    - X1: [1,2]
    - W1: [1,2]
    - X2: [1,2]
```
