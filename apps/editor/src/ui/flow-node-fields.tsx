import type { FlowConditionDraft, FlowDraftNode } from "../editor-session";

interface Option { id: string; label: string }

export interface FlowNodeFieldsProps {
  audioAssets: Option[];
  flows: Option[];
  items: Option[];
  node: FlowDraftNode;
  nodeIds: string[];
  onChange: (node: FlowDraftNode) => void;
}
function TargetSelect({ label, nodeIds, value, onChange }: { label: string; nodeIds: string[]; value: string; onChange(value: string): void }) {
  return (
    <label>{label}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select node</option>
        {nodeIds.map((id) => <option key={`${label}-${id}`} value={id}>{id}</option>)}
      </select>
    </label>
  );
}

function ConditionFields({ condition, items, onChange }: { condition: FlowConditionDraft; items: Option[]; onChange(value: FlowConditionDraft): void }) {
  return (
    <div className="flow-condition-fields">
      <label>Condition type
        <select
          value={condition.type}
          onChange={(event) => onChange({
            ...condition,
            type: event.target.value as FlowConditionDraft["type"]
          })}
        >
          <option value="flag-equals">Flag equals</option>
          <option value="item-in-inventory">Item in inventory</option>
        </select>
      </label>
      {condition.type === "flag-equals" ? (
        <>
          <label>Flag key<input value={condition.key} onChange={(event) => onChange({ ...condition, key: event.target.value })} /></label>
          <label>Value type
            <select value={condition.valueKind} onChange={(event) => onChange({ ...condition, valueKind: event.target.value as FlowConditionDraft["valueKind"] })}>
              <option value="boolean">boolean</option><option value="number">number</option><option value="string">string</option>
            </select>
          </label>
          <label>Value<input value={condition.value} onChange={(event) => onChange({ ...condition, value: event.target.value })} /></label>
        </>
      ) : (
        <label>Item
          <select value={condition.itemId} onChange={(event) => onChange({ ...condition, itemId: event.target.value })}>
            <option value="">Select item</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export function FlowNodeFields({ audioAssets, flows, items, node, nodeIds, onChange }: FlowNodeFieldsProps) {
  if (node.type === "choice") {
    return (
      <>
        <label>Prompt key<input value={node.promptKey} onChange={(event) => onChange({ ...node, promptKey: event.target.value })} /></label>
        <div className="flow-choice-options">
          {node.choices.map((choice, index) => (
            <section key={`${choice.id}-${index}`}>
              <div className="flow-node-header"><strong>Option {index + 1}</strong><button type="button" disabled={node.choices.length === 1} onClick={() => onChange({ ...node, choices: node.choices.filter((_, choiceIndex) => choiceIndex !== index) })}>Remove</button></div>
              <label>Option id<input value={choice.id} onChange={(event) => onChange({ ...node, choices: node.choices.map((entry, choiceIndex) => choiceIndex === index ? { ...entry, id: event.target.value } : entry) })} /></label>
              <label>Label key<input value={choice.labelKey} onChange={(event) => onChange({ ...node, choices: node.choices.map((entry, choiceIndex) => choiceIndex === index ? { ...entry, labelKey: event.target.value } : entry) })} /></label>
              <TargetSelect label="Next" nodeIds={nodeIds} value={choice.next} onChange={(value) => onChange({ ...node, choices: node.choices.map((entry, choiceIndex) => choiceIndex === index ? { ...entry, next: value } : entry) })} />
            </section>
          ))}
          <button type="button" onClick={() => onChange({ ...node, choices: [...node.choices, { id: `option-${node.choices.length + 1}`, labelKey: "dialogue.choice.option", next: nodeIds[0] ?? "", when: null }] })}>Add option</button>
        </div>
      </>
    );
  }
  if (node.type === "condition") {
    return <><ConditionFields condition={node.when} items={items} onChange={(when) => onChange({ ...node, when })} /><TargetSelect label="If true" nodeIds={nodeIds} value={node.ifTrue} onChange={(ifTrue) => onChange({ ...node, ifTrue })} /><TargetSelect label="If false" nodeIds={nodeIds} value={node.ifFalse} onChange={(ifFalse) => onChange({ ...node, ifFalse })} /></>;
  }
  if (node.type === "sub-flow") {
    return <><label>Flow<select value={node.flowId} onChange={(event) => onChange({ ...node, flowId: event.target.value })}><option value="">Select flow</option>{flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.label}</option>)}</select></label><TargetSelect label="Next" nodeIds={nodeIds} value={node.next} onChange={(next) => onChange({ ...node, next })} /></>;
  }
  if (node.type === "inventory") {
    return <><label>Action<select value={node.action} onChange={(event) => onChange({ ...node, action: event.target.value as "add" | "remove" })}><option value="add">Add</option><option value="remove">Remove</option></select></label><label>Item<select value={node.itemId} onChange={(event) => onChange({ ...node, itemId: event.target.value })}><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><TargetSelect label="Next" nodeIds={nodeIds} value={node.next} onChange={(next) => onChange({ ...node, next })} /></>;
  }
  if (node.type === "wait") {
    return <><label>Duration (ms)<input min={0} type="number" value={node.durationMs} onChange={(event) => onChange({ ...node, durationMs: event.target.value })} /></label><TargetSelect label="Next" nodeIds={nodeIds} value={node.next} onChange={(next) => onChange({ ...node, next })} /></>;
  }
  if (node.type === "cue") {
    return <><label>Cue type<select value={node.cueType} onChange={(event) => onChange({ ...node, cueType: event.target.value as typeof node.cueType })}><option value="sound">Sound</option><option value="camera-shake">Camera shake</option><option value="fade">Fade</option><option value="emote">Emote</option></select></label>{node.cueType === "sound" ? <label>Audio asset<select value={node.cueKey} onChange={(event) => onChange({ ...node, cueKey: event.target.value })}><option value="">Select audio</option>{audioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.label}</option>)}</select></label> : <label>Cue key<input value={node.cueKey} onChange={(event) => onChange({ ...node, cueKey: event.target.value })} /></label>}<label>Value<input value={node.cueValue} onChange={(event) => onChange({ ...node, cueValue: event.target.value })} /></label><TargetSelect label="Next" nodeIds={nodeIds} value={node.next} onChange={(next) => onChange({ ...node, next })} /></>;
  }
  return null;
}
