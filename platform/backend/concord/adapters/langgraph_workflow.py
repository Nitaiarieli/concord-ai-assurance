"""Optional orchestration example. Install the optional dependencies to run."""
from typing import TypedDict

class WorkflowState(TypedDict):
    event_id: str
    result: dict


def build_repair_workflow(engine, checkpointer):
    from langgraph.graph import StateGraph, START, END
    graph = StateGraph(WorkflowState)
    def repair(state):
        return {'result':engine.repair(state['event_id'])}
    def verify(state):
        return {'result':engine.verify(state['event_id'])}
    graph.add_node('repair', repair)
    graph.add_node('verify', verify)
    graph.add_edge(START, 'repair')
    graph.add_edge('repair', 'verify')
    graph.add_edge('verify', END)
    # The engine's state repository must be durable too; graph checkpoints alone are insufficient.
    return graph.compile(checkpointer=checkpointer)
