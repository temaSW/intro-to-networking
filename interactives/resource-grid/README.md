# Time–frequency resource grid

Reusable learning component: a finite time × frequency grid shared by several users.

## Student controls

- users and their backlog;
- static or dynamic allocation;
- optional manual painting of cells;
- number of time slots and frequency blocks.

## Observable result

Each allocated cell belongs to one user only. Show unused cells, served demand and remaining backlog. In dynamic mode, a deliberately simple scheduler may allocate cells to nonempty queues; it must not imply that this is a universal scheduler algorithm.

## Teaching use

First assign equal static shares while demands differ; then change to dynamic allocation. The key observation is opportunity cost: a cell given to Alice is unavailable to Bob at the same time and frequency.

## Current implementation

The working browser component is in `course/interactives/lecture-04-model.js` and `lecture-04-ui.js`. Static allocation reserves equal shares even when a queue is empty; dynamic allocation fills cells for nonempty queues.

## Implementation boundary

The allocation/state transition is independent of the UI. Preserve the component as a general resource-sharing model rather than a 5G-frame simulator.
