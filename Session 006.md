# Session #006

Source: [ChatGPT](https://chatgpt.com/c/6938a9f3-1f18-8331-a34d-0da1664de0b3)
Extracted: 2025-12-10T00:29:44.376Z
🚀 Exported with [Save my Chatbot](https://save.hugocolin.com)!

---

## User

Begin ORIGIN Chat Session #006.

PROJECT: Aureon XI

CONTEXT:
This continues the Aureon XI architecture.
We just completed the integration of the Supervision Runtime with the worker execution pipeline, including:
- Event bus publishing
- worker_finished → ensemble validation
- convergence/termination listeners

NEXT TASK:
Begin Session #006 by designing the distributed execution layer:
- per-node orchestrator
- queues / RQML distribution
- checkpointing
- failure recovery
- inter-node messaging

Continue where we left off.

## ChatGPT

Continuing with Session 006 by adding a distributed execution layer around the existing Aureon XI supervision and worker pipeline.

Below is a new `aureon/distributed` package that introduces:

Per node orchestrator

Distributed queues and RQML distribution

Checkpointing

Failure recovery

Inter node messaging

All types imported from `aureon.core` and `aureon.supervision` are assumed to already exist from earlier sessions.

python

Copy code

# aureon/distributed/models.py

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, List, Optional

class NodeRole(str, Enum):
 WORKER = "worker"
 SUPERVISOR = "supervisor"
 HYBRID = "hybrid"

class RQMLShardStrategy(str, Enum):
 BY_DATASET = "by_dataset"
 BY_ITERATION = "by_iteration"
 BY_SLICE = "by_slice"

@dataclass(frozen=True)
class NodeId:
 value: str

 @staticmethod
 def new() -> "NodeId":
 return NodeId(str(uuid.uuid4()))

@dataclass
class NodeRegistration:
 node_id: NodeId
 role: NodeRole
 hostname: str
 process_id: int
 started_at: float = field(default_factory=time.time)
 last_heartbeat_at: float = field(default_factory=time.time)
 metadata: Dict[str, Any] = field(default_factory=dict)

class NodeHealth(str, Enum):
 HEALTHY = "healthy"
 UNRESPONSIVE = "unresponsive"
 DRAINING = "draining"
 DEAD = "dead"

@dataclass
class NodeStatus:
 node_id: NodeId
 health: NodeHealth
 active_tasks: int
 max_concurrency: int
 last_heartbeat_at: float
 metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class TaskLease:
 message_id: str
 node_id: NodeId
 acquired_at: float
 visibility_deadline: float

@dataclass
class CheckpointId:
 value: str

 @staticmethod
 def new() -> "CheckpointId":
 return CheckpointId(str(uuid.uuid4()))

@dataclass
class CheckpointRecord:
 checkpoint_id: CheckpointId
 task_id: str
 rqml_run_id: str
 iteration: int
 shard_key: Optional[str]
 node_id: NodeId
 created_at: float
 payload: Dict[str, Any]
 supervisor_snapshot: Optional[Dict[str, Any]] = None
 metadata: Dict[str, Any] = field(default_factory=dict)

class ControlMessageType(str, Enum):
 HEARTBEAT = "heartbeat"
 REBALANCE_REQUEST = "rebalance_request"
 DRAIN_NODE = "drain_node"
 RESUME_NODE = "resume_node"
 TASK_REASSIGNMENT = "task_reassignment"

@dataclass
class ControlMessage:
 message_id: str
 sender: NodeId
 message_type: ControlMessageType
 created_at: float
 body: Dict[str, Any]

@dataclass
class RQMLShardAssignment:
 rqml_run_id: str
 dataset_id: str
 iteration: int
 shard_key: str
 target_node: NodeId
 strategy: RQMLShardStrategy
 metadata: Dict[str, Any] = field(default_factory=dict)

python

Copy code

# aureon/distributed/queues.py

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, Generic, Optional, Protocol, TypeVar

from .models import NodeId, TaskLease

T = TypeVar("T")

class QueueMessage(Generic[T]):
 def __init__(self, message_id: str, payload: T):
 self.id = message_id
 self.payload = payload

class DistributedQueue(Protocol, Generic[T]):
 async def enqueue(self, payload: T, *, delay_seconds: int | None = None) -> str:
 ...

 async def dequeue(self, *, visibility_timeout: int) -> Optional[QueueMessage[T]]:
 ...

 async def ack(self, message_id: str) -> None:
 ...

 async def nack(self, message_id: str, *, requeue: bool = True) -> None:
 ...

 async def extend_visibility(self, message_id: str, *, visibility_timeout: int) -> None:
 ...

@dataclass
class _InMemoryQueueItem(Generic[T]):
 id: str
 payload: T
 visible_at: float

class InMemoryDistributedQueue(DistributedQueue[T]):
 """
 Simple in process queue implementation used for local development and tests.
 Production deployments should provide Redis, Kafka or other backends that
 implement the DistributedQueue protocol.
 """

 def __init__(self) -> None:
 self._messages: Dict[str, _InMemoryQueueItem[T]] = {}

 async def enqueue(self, payload: T, *, delay_seconds: int | None = None) -> str:
 msg_id = str(uuid.uuid4())
 visible_at = time.time() + (delay_seconds or 0)
 self._messages[msg_id] = _InMemoryQueueItem(msg_id, payload, visible_at)
 return msg_id

 async def dequeue(self, *, visibility_timeout: int) -> Optional[QueueMessage[T]]:
 now = time.time()
 for msg in list(self._messages.values()):
 if msg.visible_at <= now:
 msg.visible_at = now + visibility_timeout
 return QueueMessage(msg.id, msg.payload)
 return None

 async def ack(self, message_id: str) -> None:
 self._messages.pop(message_id, None)

 async def nack(self, message_id: str, *, requeue: bool = True) -> None:
 msg = self._messages.get(message_id)
 if not msg:
 return
 if requeue:
 msg.visible_at = time.time()
 else:
 self._messages.pop(message_id, None)

 async def extend_visibility(self, message_id: str, *, visibility_timeout: int) -> None:
 msg = self._messages.get(message_id)
 if msg:
 msg.visible_at = time.time() + visibility_timeout

@dataclass
class TaskEnvelope:
 """
 Wraps a logical Task for the distributed layer.
 """

 task_id: str
 rqml_run_id: str
 iteration: int
 shard_key: Optional[str]
 payload: Dict[str, Any]
 created_at: float
 metadata: Dict[str, Any]

class LeaseManager:
 """
 Tracks leases locally so a node can decide whether it still owns work
 after restarts and so that we can support local failure recovery logic.
 """

 def __init__(self, node_id: NodeId) -> None:
 self.node_id = node_id
 self._leases: Dict[str, TaskLease] = {}

 def acquire(self, message_id: str, visibility_timeout: int) -> TaskLease:
 now = time.time()
 lease = TaskLease(
 message_id=message_id,
 node_id=self.node_id,
 acquired_at=now,
 visibility_deadline=now + visibility_timeout,
 )
 self._leases[message_id] = lease
 return lease

 def renew(self, message_id: str, visibility_timeout: int) -> None:
 lease = self._leases.get(message_id)
 if not lease:
 return
 now = time.time()
 lease.visibility_deadline = now + visibility_timeout

 def release(self, message_id: str) -> None:
 self._leases.pop(message_id, None)

 def expired_leases(self, *, margin_seconds: int = 0) -> Dict[str, TaskLease]:
 now = time.time()
 return {
 mid: lease
 for mid, lease in self._leases.items()
 if lease.visibility_deadline + margin_seconds < now
 }

python

Copy code

# aureon/distributed/checkpoints.py

from __future__ import annotations

import json
import os
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict, List, Optional

from .models import CheckpointRecord, CheckpointId

class CheckpointStore(ABC):
 @abstractmethod
 async def save(self, record: CheckpointRecord) -> None:
 ...

 @abstractmethod
 async def latest_for_task(self, task_id: str) -> Optional[CheckpointRecord]:
 ...

 @abstractmethod
 async def all_for_task(self, task_id: str) -> List[CheckpointRecord]:
 ...

class InMemoryCheckpointStore(CheckpointStore):
 def __init__(self) -> None:
 self._records: Dict[str, List[CheckpointRecord]] = {}

 async def save(self, record: CheckpointRecord) -> None:
 self._records.setdefault(record.task_id, []).append(record)

 async def latest_for_task(self, task_id: str) -> Optional[CheckpointRecord]:
 records = self._records.get(task_id) or []
 if not records:
 return None
 return max(records, key=lambda r: r.created_at)

 async def all_for_task(self, task_id: str) -> List[CheckpointRecord]:
 return list(self._records.get(task_id) or [])

class JsonFileCheckpointStore(CheckpointStore):
 """
 Simple file based store for development.
 Each task gets its own directory; each checkpoint is a json file.
 """

 def __init__(self, base_dir: str | Path) -> None:
 self.base_dir = Path(base_dir)
 self.base_dir.mkdir(parents=True, exist_ok=True)

 def _task_dir(self, task_id: str) -> Path:
 d = self.base_dir / task_id
 d.mkdir(parents=True, exist_ok=True)
 return d

 async def save(self, record: CheckpointRecord) -> None:
 task_dir = self._task_dir(record.task_id)
 filename = f"{record.created_at:.6f}_{record.checkpoint_id.value}.json"
 path = task_dir / filename
 payload = {
 "checkpoint_id": record.checkpoint_id.value,
 "task_id": record.task_id,
 "rqml_run_id": record.rqml_run_id,
 "iteration": record.iteration,
 "shard_key": record.shard_key,
 "node_id": record.node_id.value,
 "created_at": record.created_at,
 "payload": record.payload,
 "supervisor_snapshot": record.supervisor_snapshot,
 "metadata": record.metadata,
 }
 path.write_text(json.dumps(payload))

 async def latest_for_task(self, task_id: str) -> Optional[CheckpointRecord]:
 task_dir = self._task_dir(task_id)
 files = sorted(task_dir.glob("*.json"))
 if not files:
 return None
 latest = files[-1]
 return await self._load_from_file(task_id, latest)

 async def all_for_task(self, task_id: str) -> List[CheckpointRecord]:
 task_dir = self._task_dir(task_id)
 if not task_dir.exists():
 return []
 files = sorted(task_dir.glob("*.json"))
 out: List[CheckpointRecord] = []
 for f in files:
 rec = await self._load_from_file(task_id, f)
 out.append(rec)
 return out

 async def _load_from_file(self, task_id: str, path: Path) -> CheckpointRecord:
 data = json.loads(path.read_text())
 return CheckpointRecord(
 checkpoint_id=CheckpointId(data["checkpoint_id"]),
 task_id=data["task_id"],
 rqml_run_id=data["rqml_run_id"],
 iteration=data["iteration"],
 shard_key=data.get("shard_key"),
 node_id=NodeId(data["node_id"]),
 created_at=data["created_at"],
 payload=data["payload"],
 supervisor_snapshot=data.get("supervisor_snapshot"),
 metadata=data.get("metadata") or {},
 )

python

Copy code

# aureon/distributed/messaging.py

from __future__ import annotations

import asyncio
import json
import time
import uuid
from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable, Dict

from .models import ControlMessage, ControlMessageType, NodeId, NodeStatus

ControlHandler = Callable[[ControlMessage], Awaitable[None]]

class InterNodeMessenger(ABC):
 @abstractmethod
 async def publish(self, message: ControlMessage) -> None:
 ...

 @abstractmethod
 async def subscribe(self, handler: ControlHandler) -> None:
 ...

class InMemoryMessenger(InterNodeMessenger):
 """
 Simple shared process messenger used in tests or single process demos.
 For production, replace with Redis pubsub, NATS, Kafka or similar.
 """

 def __init__(self) -> None:
 self._handlers: list[ControlHandler] = []

 async def publish(self, message: ControlMessage) -> None:
 for handler in list(self._handlers):
 asyncio.create_task(handler(message))

 async def subscribe(self, handler: ControlHandler) -> None:
 self._handlers.append(handler)

def make_heartbeat_message(node_status: NodeStatus) -> ControlMessage:
 return ControlMessage(
 message_id=str(uuid.uuid4()),
 sender=node_status.node_id,
 message_type=ControlMessageType.HEARTBEAT,
 created_at=time.time(),
 body={
 "health": node_status.health.value,
 "active_tasks": node_status.active_tasks,
 "max_concurrency": node_status.max_concurrency,
 "last_heartbeat_at": node_status.last_heartbeat_at,
 "metadata": node_status.metadata,
 },
 )

python

Copy code

# aureon/distributed/orchestrator.py

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, Optional

from aureon.core.tasks import Task, TaskResult # from earlier sessions
from aureon.core.rqml import RQMLContext # existing RQML context abstraction
from aureon.events import EventBus # existing event bus
from aureon.supervision.runtime import SupervisionRuntime

from .checkpoints import CheckpointStore
from .messaging import InterNodeMessenger, make_heartbeat_message
from .models import (
 NodeId,
 NodeRegistration,
 NodeRole,
 NodeStatus,
 NodeHealth,
 CheckpointRecord,
 CheckpointId,
)
from .queues import DistributedQueue, TaskEnvelope, LeaseManager, QueueMessage

WorkerFn = Callable[[Task, RQMLContext], Awaitable[TaskResult]]

@dataclass
class OrchestratorConfig:
 max_concurrency: int = 8
 visibility_timeout_seconds: int = 60
 heartbeat_interval_seconds: int = 10
 checkpoint_interval_seconds: int = 30
 lease_expiry_margin_seconds: int = 5

@dataclass
class NodeOrchestrator:
 """
 Per node orchestrator that:
 - pulls TaskEnvelope messages from the distributed queue
 - acquires local leases
 - invokes the existing worker pipeline and SupervisionRuntime
 - checkpoints intermediate RQML state
 - publishes node heartbeats and task events
 """

 registration: NodeRegistration
 config: OrchestratorConfig
 task_queue: DistributedQueue[TaskEnvelope]
 supervision: SupervisionRuntime
 event_bus: EventBus
 checkpoint_store: CheckpointStore
 messenger: InterNodeMessenger
 build_task: Callable[[TaskEnvelope], Task]
 build_rqml_context: Callable[[TaskEnvelope], RQMLContext]
 worker_fn: WorkerFn

 _lease_manager: LeaseManager = field(init=False)
 _stopped: bool = field(default=False, init=False)
 _active_tasks: int = field(default=0, init=False)
 _last_checkpoint_flush: float = field(default_factory=time.time, init=False)

 def __post_init__(self) -> None:
 self._lease_manager = LeaseManager(self.registration.node_id)

 async def start(self) -> None:
 """
 Start all orchestrator loops:
 - intake loop
 - heartbeat loop
 - lease monitor loop
 """
 intake = asyncio.create_task(self._intake_loop())
 heartbeat = asyncio.create_task(self._heartbeat_loop())
 lease_monitor = asyncio.create_task(self._lease_monitor_loop())
 await asyncio.gather(intake, heartbeat, lease_monitor)

 async def stop(self) -> None:
 self._stopped = True

 async def _intake_loop(self) -> None:
 sem = asyncio.Semaphore(self.config.max_concurrency)
 while not self._stopped:
 await sem.acquire()
 msg = await self.task_queue.dequeue(
 visibility_timeout=self.config.visibility_timeout_seconds
 )
 if msg is None:
 sem.release()
 await asyncio.sleep(0.1)
 continue

 lease = self._lease_manager.acquire(
 message_id=msg.id,
 visibility_timeout=self.config.visibility_timeout_seconds,
 )
 self._active_tasks += 1
 asyncio.create_task(self._run_task(msg, lease, sem))

 async def _run_task(
 self,
 msg: QueueMessage[TaskEnvelope],
 lease: "TaskLease",
 sem: asyncio.Semaphore,
 ) -> None:
 try:
 envelope = msg.payload
 task = self.build_task(envelope)
 rqml_ctx = self.build_rqml_context(envelope)

 # Let the supervision runtime wrap execution,
 # which already publishes worker_finished and runs ensemble validation.
 result = await self.supervision.run_task(task, rqml_ctx, self.worker_fn)

 # Persist a checkpoint after successful completion.
 await self._checkpoint(envelope, result)

 await self.task_queue.ack(msg.id)
 self._lease_manager.release(msg.id)
 self._active_tasks -= 1

 except Exception as exc:
 # Let supervision know about the failure and request requeue.
 await self.event_bus.publish(
 "task_failed",
 {
 "node_id": self.registration.node_id.value,
 "message_id": msg.id,
 "error": repr(exc),
 },
 )
 await self.task_queue.nack(msg.id, requeue=True)
 self._lease_manager.release(msg.id)
 self._active_tasks -= 1

 finally:
 sem.release()

 async def _heartbeat_loop(self) -> None:
 while not self._stopped:
 status = NodeStatus(
 node_id=self.registration.node_id,
 health=NodeHealth.HEALTHY,
 active_tasks=self._active_tasks,
 max_concurrency=self.config.max_concurrency,
 last_heartbeat_at=time.time(),
 metadata=self.registration.metadata,
 )
 msg = make_heartbeat_message(status)
 await self.messenger.publish(msg)
 await asyncio.sleep(self.config.heartbeat_interval_seconds)

 async def _lease_monitor_loop(self) -> None:
 while not self._stopped:
 expired = self._lease_manager.expired_leases(
 margin_seconds=self.config.lease_expiry_margin_seconds
 )
 for message_id, lease in expired.items():
 # If leases expire locally, assume we lost ownership.
 # We do not directly requeue here because the backend
 # will make the message visible again when visibility
 # timeout expires. We only raise a warning to the event bus.
 await self.event_bus.publish(
 "lease_expired",
 {
 "node_id": lease.node_id.value,
 "message_id": lease.message_id,
 "visibility_deadline": lease.visibility_deadline,
 },
 )
 self._lease_manager.release(message_id)
 await asyncio.sleep(1.0)

 async def _checkpoint(self, envelope: TaskEnvelope, result: TaskResult) -> None:
 now = time.time()
 record = CheckpointRecord(
 checkpoint_id=CheckpointId.new(),
 task_id=envelope.task_id,
 rqml_run_id=envelope.rqml_run_id,
 iteration=envelope.iteration,
 shard_key=envelope.shard_key,
 node_id=self.registration.node_id,
 created_at=now,
 payload={
 "task_result": result.to_dict() if hasattr(result, "to_dict") else result, # type: ignore[arg-type]
 },
 supervisor_snapshot=self.supervision.snapshot(),
 metadata=envelope.metadata,
 )
 await self.checkpoint_store.save(record)

python

Copy code

# aureon/distributed/node_entrypoint.py

from __future__ import annotations

import asyncio
import os
import socket
from typing import Any, Dict

from aureon.core.tasks import Task
from aureon.core.rqml import RQMLContext
from aureon.events import EventBus
from aureon.supervision.runtime import SupervisionRuntime

from .checkpoints import InMemoryCheckpointStore
from .messaging import InMemoryMessenger
from .models import NodeId, NodeRegistration, NodeRole
from .orchestrator import NodeOrchestrator, OrchestratorConfig, WorkerFn
from .queues import InMemoryDistributedQueue, TaskEnvelope

def build_task(envelope: TaskEnvelope) -> Task:
 # Adapter from TaskEnvelope to existing Task model.
 return Task(
 id=envelope.task_id,
 rqml_run_id=envelope.rqml_run_id,
 iteration=envelope.iteration,
 payload=envelope.payload,
 metadata=envelope.metadata,
 )

def build_rqml_context(envelope: TaskEnvelope) -> RQMLContext:
 return RQMLContext(
 run_id=envelope.rqml_run_id,
 iteration=envelope.iteration,
 shard_key=envelope.shard_key,
 metadata=envelope.metadata,
 )

async def example_worker(task: Task, ctx: RQMLContext) -> Any:
 """
 Placeholder worker implementation.
 In the real system this calls the router, ensemble, and model providers
 as already established in earlier sessions.
 """
 # The existing worker pipeline should be wired in here.
 return {"task_id": task.id, "status": "ok"}

async def main() -> None:
 node_id = NodeId.new()
 registration = NodeRegistration(
 node_id=node_id,
 role=NodeRole.HYBRID,
 hostname=socket.gethostname(),
 process_id=os.getpid(),
 metadata={},
 )

 config = OrchestratorConfig(
 max_concurrency=4,
 visibility_timeout_seconds=60,
 heartbeat_interval_seconds=10,
 checkpoint_interval_seconds=30,
 lease_expiry_margin_seconds=5,
 )

 # For real deployment, these should be injected with production backends.
 task_queue = InMemoryDistributedQueue[TaskEnvelope]()
 supervision = SupervisionRuntime.default()
 event_bus = EventBus.default()
 checkpoint_store = InMemoryCheckpointStore()
 messenger = InMemoryMessenger()

 orchestrator = NodeOrchestrator(
 registration=registration,
 config=config,
 task_queue=task_queue,
 supervision=supervision,
 event_bus=event_bus,
 checkpoint_store=checkpoint_store,
 messenger=messenger,
 build_task=build_task,
 build_rqml_context=build_rqml_context,
 worker_fn=example_worker, # replace with real worker pipeline
 )

 await orchestrator.start()

if __name__ == "__main__":
 asyncio.run(main())

This gives Aureon XI a concrete distributed execution layer that:

Runs a per node orchestrator around the existing SupervisionRuntime and worker pipeline

Uses a pluggable queue abstraction for RQML task distribution

Persists checkpoints per task, run, iteration and shard

Tracks leases for failure recovery and reprocessing

Publishes node heartbeats and other control messages for inter node coordination

Next steps can extend this with a real queue backend (Redis or Kafka), a production messenger, and a coordinator that assigns RQML shards to nodes using the `RQMLShardAssignment` model.

## User

Proceed

## ChatGPT

Adding the next layer for ORIGIN Session 006: cluster coordination, shard planning, and more explicit failure recovery on top of the distributed primitives we just created.

Below are additional modules under `aureon/distributed` and a small update to the `NodeOrchestrator` to listen for control messages.

### 1. Shard planning for RQML distribution

python

Copy code

# aureon/distributed/sharding.py

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

from .models import NodeId, RQMLShardStrategy
from .queues import TaskEnvelope

@dataclass
class RQMLRunSpec:
 """
 Describes a single RQML run whose work needs to be distributed.
 """
 rqml_run_id: str
 dataset_id: str
 iteration: int
 total_items: int
 shard_size: int
 strategy: RQMLShardStrategy
 metadata: Dict[str, Any]

@dataclass
class ShardPlan:
 """
 A concrete decomposition of a run into shard keys and assignments.
 """
 run_spec: RQMLRunSpec
 shard_keys: List[str]

class ShardPlanner:
 """
 Converts an RQMLRunSpec into shard keys.
 Higher level assignment of those shard keys to nodes is handled by the cluster coordinator.
 """

 def build_plan(self, spec: RQMLRunSpec) -> ShardPlan:
 shard_keys: List[str] = []

 if spec.strategy in {RQMLShardStrategy.BY_DATASET, RQMLShardStrategy.BY_SLICE}:
 # Group items into contiguous slices.
 # Example shard key: "slice:0:100"
 for start in range(0, spec.total_items, spec.shard_size):
 end = min(start + spec.shard_size, spec.total_items)
 shard_keys.append(f"slice:{start}:{end}")

 elif spec.strategy == RQMLShardStrategy.BY_ITERATION:
 # One shard per item; iteration aware downstream.
 # Example shard key: "item:42"
 for idx in range(spec.total_items):
 shard_keys.append(f"item:{idx}")

 else:
 raise ValueError(f"Unsupported shard strategy: {spec.strategy}")

 return ShardPlan(run_spec=spec, shard_keys=shard_keys)

 def build_envelopes_for_node(
 self,
 spec: RQMLRunSpec,
 shard_keys: Iterable[str],
 target_node: NodeId,
 ) -> List[TaskEnvelope]:
 envelopes: List[TaskEnvelope] = []
 for shard_key in shard_keys:
 envelopes.append(
 TaskEnvelope(
 task_id=f"{spec.rqml_run_id}:{spec.iteration}:{shard_key}",
 rqml_run_id=spec.rqml_run_id,
 iteration=spec.iteration,
 shard_key=shard_key,
 payload={
 "dataset_id": spec.dataset_id,
 "shard_key": shard_key,
 },
 created_at=0.0, # set by scheduler
 metadata={
 "target_node": target_node.value,
 "strategy": spec.strategy.value,
 **spec.metadata,
 },
 )
 )
 return envelopes

### 2. Cluster state and coordinator (assignment + rebalancing)

python

Copy code

# aureon/distributed/cluster.py

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from .messaging import InterNodeMessenger
from .models import (
 NodeId,
 NodeStatus,
 NodeHealth,
 ControlMessage,
 ControlMessageType,
 RQMLShardStrategy,
)
from .queues import DistributedQueue, TaskEnvelope
from .sharding import RQMLRunSpec, ShardPlanner, ShardPlan

@dataclass
class ClusterState:
 """
 In memory view of nodes in the cluster.
 This is maintained by the coordinator based on heartbeats and control messages.
 """

 nodes: Dict[str, NodeStatus] = field(default_factory=dict)
 last_updated_at: float = field(default_factory=time.time)

 def update_node(self, status: NodeStatus) -> None:
 self.nodes[status.node_id.value] = status
 self.last_updated_at = time.time()

 def remove_node(self, node_id: NodeId) -> None:
 self.nodes.pop(node_id.value, None)
 self.last_updated_at = time.time()

 def healthy_nodes(self) -> List[NodeStatus]:
 return [
 s
 for s in self.nodes.values()
 if s.health in {NodeHealth.HEALTHY, NodeHealth.DRAINING}
 ]

 def least_loaded_nodes(self) -> List[NodeStatus]:
 return sorted(self.healthy_nodes(), key=lambda s: s.active_tasks)

@dataclass
class ShardAssignment:
 shard_key: str
 node_id: NodeId

@dataclass
class ClusterCoordinator:
 """
 Central coordinator responsible for:
 - tracking node heartbeats
 - assigning RQML shards to nodes
 - emitting TaskEnvelopes into the distributed queue
 - reacting to rebalance or drain commands
 """

 cluster_state: ClusterState
 messenger: InterNodeMessenger
 task_queue: DistributedQueue[TaskEnvelope]
 shard_planner: ShardPlanner

 async def start(self) -> None:
 await self.messenger.subscribe(self._handle_control_message)

 async def _handle_control_message(self, msg: ControlMessage) -> None:
 if msg.message_type == ControlMessageType.HEARTBEAT:
 await self._on_heartbeat(msg)
 elif msg.message_type == ControlMessageType.REBALANCE_REQUEST:
 await self._on_rebalance_request(msg)
 elif msg.message_type == ControlMessageType.DRAIN_NODE:
 await self._on_drain_node(msg)
 elif msg.message_type == ControlMessageType.RESUME_NODE:
 await self._on_resume_node(msg)
 elif msg.message_type == ControlMessageType.TASK_REASSIGNMENT:
 # Incoming reassignment messages could be honored by nodes.
 # For now the coordinator does not need to do anything else here.
 return

 async def _on_heartbeat(self, msg: ControlMessage) -> None:
 body = msg.body
 node_id = msg.sender
 status = NodeStatus(
 node_id=node_id,
 health=NodeHealth(body.get("health", NodeHealth.HEALTHY)),
 active_tasks=int(body.get("active_tasks", 0)),
 max_concurrency=int(body.get("max_concurrency", 0)),
 last_heartbeat_at=float(body.get("last_heartbeat_at", time.time())),
 metadata=body.get("metadata") or {},
 )
 self.cluster_state.update_node(status)

 async def _on_drain_node(self, msg: ControlMessage) -> None:
 node_id = NodeId(msg.body["node_id"])
 status = self.cluster_state.nodes.get(node_id.value)
 if not status:
 return
 status.health = NodeHealth.DRAINING
 self.cluster_state.update_node(status)

 async def _on_resume_node(self, msg: ControlMessage) -> None:
 node_id = NodeId(msg.body["node_id"])
 status = self.cluster_state.nodes.get(node_id.value)
 if not status:
 return
 status.health = NodeHealth.HEALTHY
 self.cluster_state.update_node(status)

 async def _on_rebalance_request(self, msg: ControlMessage) -> None:
 """
 For now this only logs intent. A more elaborate implementation can:
 - inspect pending tasks in the backend queue
 - move unstarted shards toward less loaded nodes
 """
 # Placeholder hook for future rebalancing logic.
 return

 async def schedule_run(self, spec: RQMLRunSpec) -> None:
 """
 Compute a shard plan and push TaskEnvelopes into the distributed queue
 with a simple least loaded placement strategy.
 """

 plan: ShardPlan = self.shard_planner.build_plan(spec)
 nodes = self.cluster_state.least_loaded_nodes()

 if not nodes:
 raise RuntimeError("No healthy nodes available for scheduling")

 assignments: List[ShardAssignment] = self._assign_shards(plan, nodes)

 now = time.time()
 for assignment in assignments:
 envelope = TaskEnvelope(
 task_id=f"{spec.rqml_run_id}:{spec.iteration}:{assignment.shard_key}",
 rqml_run_id=spec.rqml_run_id,
 iteration=spec.iteration,
 shard_key=assignment.shard_key,
 payload={
 "dataset_id": spec.dataset_id,
 "shard_key": assignment.shard_key,
 },
 created_at=now,
 metadata={
 "target_node": assignment.node_id.value,
 "strategy": spec.strategy.value,
 **spec.metadata,
 },
 )
 await self.task_queue.enqueue(envelope)

 def _assign_shards(
 self, plan: ShardPlan, nodes: List[NodeStatus]
 ) -> List[ShardAssignment]:
 assignments: List[ShardAssignment] = []
 if not nodes:
 return assignments

 # Simple round robin across least loaded nodes.
 sorted_nodes = list(nodes)
 index = 0
 for shard_key in plan.shard_keys:
 node_status = sorted_nodes[index % len(sorted_nodes)]
 assignments.append(
 ShardAssignment(shard_key=shard_key, node_id=node_status.node_id)
 )
 index += 1
 return assignments

### 3. Failure recovery utilities

This focuses on detection of dead nodes and generating reassignment control messages. It assumes the persistent queue backend will make leases visible again once visibility timeouts expire, so reassignment here is mostly advisory and for more advanced backends.

python

Copy code

# aureon/distributed/recovery.py

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import List

from .cluster import ClusterState
from .messaging import InterNodeMessenger
from .models import (
 NodeId,
 NodeHealth,
 ControlMessage,
 ControlMessageType,
)
from .queues import DistributedQueue, TaskEnvelope

@dataclass
class RecoveryConfig:
 heartbeat_timeout_seconds: int = 60
 scan_interval_seconds: int = 10

@dataclass
class FailureRecoveryService:
 """
 Periodically scans for unresponsive nodes and emits control messages
 so that the cluster can drain them and allow tasks to be picked up by others.
 The underlying queue backend handles visibility timeouts and re-delivery.
 """

 cluster_state: ClusterState
 messenger: InterNodeMessenger
 task_queue: DistributedQueue[TaskEnvelope]
 config: RecoveryConfig

 async def start(self) -> None:
 while True:
 await self._scan()
 await asyncio.sleep(self.config.scan_interval_seconds)

 async def _scan(self) -> None:
 now = time.time()
 for node_status in list(self.cluster_state.nodes.values()):
 if (
 node_status.health in {NodeHealth.HEALTHY, NodeHealth.DRAINING}
 and now - node_status.last_heartbeat_at > self.config.heartbeat_timeout_seconds
 ):
 node_status.health = NodeHealth.UNRESPONSIVE
 self.cluster_state.update_node(node_status)

 # Emit a drain message so nodes and operators are aware.
 msg = ControlMessage(
 message_id=f"drain:{node_status.node_id.value}:{now}",
 sender=NodeId("coordinator"),
 message_type=ControlMessageType.DRAIN_NODE,
 created_at=now,
 body={"node_id": node_status.node_id.value},
 )
 await self.messenger.publish(msg)

*(You will need to `import asyncio` at the top of this file.)*

### 4. Update `NodeOrchestrator` to listen for control messages

We now wire the node into `InterNodeMessenger.subscribe` so that it can respond to control signals such as DRAIN_NODE and RESUME_NODE.

python

Copy code

# aureon/distributed/orchestrator.py

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, Optional

from aureon.core.tasks import Task, TaskResult
from aureon.core.rqml import RQMLContext
from aureon.events import EventBus
from aureon.supervision.runtime import SupervisionRuntime

from .checkpoints import CheckpointStore
from .messaging import InterNodeMessenger, make_heartbeat_message
from .models import (
 NodeId,
 NodeRegistration,
 NodeRole,
 NodeStatus,
 NodeHealth,
 CheckpointRecord,
 CheckpointId,
 ControlMessage,
 ControlMessageType,
)
from .queues import DistributedQueue, TaskEnvelope, LeaseManager, QueueMessage

WorkerFn = Callable[[Task, RQMLContext], Awaitable[TaskResult]]

@dataclass
class OrchestratorConfig:
 max_concurrency: int = 8
 visibility_timeout_seconds: int = 60
 heartbeat_interval_seconds: int = 10
 checkpoint_interval_seconds: int = 30
 lease_expiry_margin_seconds: int = 5

@dataclass
class NodeOrchestrator:
 ...

 _draining: bool = field(default=False, init=False)

 def __post_init__(self) -> None:
 self._lease_manager = LeaseManager(self.registration.node_id)

 async def start(self) -> None:
 """
 Start all orchestrator loops:
 - intake loop
 - heartbeat loop
 - lease monitor loop
 - control message subscription
 """
 await self.messenger.subscribe(self._handle_control_message)

 intake = asyncio.create_task(self._intake_loop())
 heartbeat = asyncio.create_task(self._heartbeat_loop())
 lease_monitor = asyncio.create_task(self._lease_monitor_loop())
 await asyncio.gather(intake, heartbeat, lease_monitor)

 async def _handle_control_message(self, msg: ControlMessage) -> None:
 if msg.message_type == ControlMessageType.DRAIN_NODE:
 node_id = msg.body.get("node_id")
 if node_id == self.registration.node_id.value:
 self._draining = True
 await self.event_bus.publish(
 "node_draining",
 {"node_id": self.registration.node_id.value},
 )
 elif msg.message_type == ControlMessageType.RESUME_NODE:
 node_id = msg.body.get("node_id")
 if node_id == self.registration.node_id.value:
 self._draining = False
 await self.event_bus.publish(
 "node_resumed",
 {"node_id": self.registration.node_id.value},
 )

 async def _intake_loop(self) -> None:
 sem = asyncio.Semaphore(self.config.max_concurrency)
 while not self._stopped:
 if self._draining:
 # During draining the node finishes existing tasks but does not
 # acquire new work.
 await asyncio.sleep(0.5)
 continue

 await sem.acquire()
 msg = await self.task_queue.dequeue(
 visibility_timeout=self.config.visibility_timeout_seconds
 )
 if msg is None:
 sem.release()
 await asyncio.sleep(0.1)
 continue

 lease = self._lease_manager.acquire(
 message_id=msg.id,
 visibility_timeout=self.config.visibility_timeout_seconds,
 )
 self._active_tasks += 1
 asyncio.create_task(self._run_task(msg, lease, sem))

The remaining methods in `NodeOrchestrator` stay as defined previously.

### 5. Example coordinator entrypoint

A small example that wires together the coordinator side, similar to `node_entrypoint.py` for a worker node.

python

Copy code

# aureon/distributed/coordinator_entrypoint.py

from __future__ import annotations

import asyncio

from .cluster import ClusterCoordinator, ClusterState
from .messaging import InMemoryMessenger
from .queues import InMemoryDistributedQueue, TaskEnvelope
from .sharding import ShardPlanner, RQMLRunSpec
from .models import RQMLShardStrategy

async def main() -> None:
 messenger = InMemoryMessenger()
 task_queue = InMemoryDistributedQueue[TaskEnvelope]()
 cluster_state = ClusterState()
 shard_planner = ShardPlanner()

 coordinator = ClusterCoordinator(
 cluster_state=cluster_state,
 messenger=messenger,
 task_queue=task_queue,
 shard_planner=shard_planner,
 )

 await coordinator.start()

 # Example RQML run specification.
 spec = RQMLRunSpec(
 rqml_run_id="rqml-run-001",
 dataset_id="dataset-A",
 iteration=0,
 total_items=10_000,
 shard_size=1_000,
 strategy=RQMLShardStrategy.BY_SLICE,
 metadata={},
 )

 await coordinator.schedule_run(spec)

if __name__ == "__main__":
 asyncio.run(main())

This extends Session 006 with:

A shard planner that turns RQML runs into shard keys and envelopes.

A cluster coordinator that tracks node health from heartbeats and assigns shards to nodes.

A basic failure recovery service that flags nodes as unresponsive and drains them.

Node level response to control messages, including draining and resuming, with no change to the existing supervision or worker pipeline.

We can next tighten the interfaces with the RQML refinement loop, so that convergence events directly trigger new `RQMLRunSpec` objects and feed them through this distributed layer.

