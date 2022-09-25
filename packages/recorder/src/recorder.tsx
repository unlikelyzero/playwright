/*
  Copyright (c) Microsoft Corporation.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type { CallLog, Mode, Source } from './recorderTypes';
import { Source as SourceView } from '@web/components/source';
import { SplitView } from '@web/components/splitView';
import { Toolbar } from '@web/components/toolbar';
import { ToolbarButton } from '@web/components/toolbarButton';
import * as React from 'react';
import { CallLogView } from './callLog';
import './recorder.css';

declare global {
  interface Window {
    playwrightSetFileIfNeeded: (file: string) => void;
    playwrightSetSelector: (selector: string, focus?: boolean) => void;
    dispatch(data: any): Promise<void>;
  }
}

export interface RecorderProps {
  sources: Source[],
  paused: boolean,
  log: Map<string, CallLog>,
  mode: Mode,
  initialSelector?: string,
}

export const Recorder: React.FC<RecorderProps> = ({
  sources,
  paused,
  log,
  mode,
  initialSelector,
}) => {
  const [selector, setSelector] = React.useState(initialSelector || '');
  const [focusSelectorInput, setFocusSelectorInput] = React.useState(false);
  window.playwrightSetSelector = (selector: string, focus?: boolean) => {
    setSelector(selector);
    setFocusSelectorInput(!!focus);
  };

  const [fileId, setFileId] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (!fileId && sources.length > 0)
      setFileId(sources[0].id);
  }, [fileId, sources]);

  const source: Source = sources.find(s => s.id === fileId) || {
    id: 'default',
    isRecorded: false,
    text: '',
    language: 'javascript',
    label: '',
    highlight: []
  };
  window.playwrightSetFileIfNeeded = (value: string) => {
    const newSource = sources.find(s => s.id === value);
    // Do not forcefully switch between two recorded sources, because
    // user did explicitly choose one.
    if (newSource && !newSource.isRecorded || !source.isRecorded)
      setFileId(value);
  };

  const messagesEndRef = React.createRef<HTMLDivElement>();
  React.useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [messagesEndRef]);

  const selectorInputRef = React.createRef<HTMLInputElement>();
  React.useLayoutEffect(() => {
    if (focusSelectorInput && selectorInputRef.current) {
      selectorInputRef.current.select();
      selectorInputRef.current.focus();
      setFocusSelectorInput(false);
    }
  }, [focusSelectorInput, selectorInputRef]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'F8':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'resume' });
          else
            window.dispatch({ event: 'pause' });
          break;
        case 'F10':
          event.preventDefault();
          if (paused)
            window.dispatch({ event: 'step' });
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [paused]);

  return <div className='recorder'>
    <Toolbar>
      <ToolbarButton icon='record' title='Record' toggled={mode === 'recording'} onClick={() => {
        window.dispatch({ event: 'setMode', params: { mode: mode === 'recording' ? 'none' : 'recording' } });
      }}>Record</ToolbarButton>
      <ToolbarButton icon='files' title='Copy' disabled={!source || !source.text} onClick={() => {
        copy(source.text);
      }}></ToolbarButton>
      <ToolbarButton icon='debug-continue' title='Resume (F8)' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'resume' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-pause' title='Pause (F8)' disabled={paused} onClick={() => {
        window.dispatch({ event: 'pause' });
      }}></ToolbarButton>
      <ToolbarButton icon='debug-step-over' title='Step over (F10)' disabled={!paused} onClick={() => {
        window.dispatch({ event: 'step' });
      }}></ToolbarButton>
      <div style={{ flex: 'auto' }}></div>
      <div>Target:</div>
      <select className='recorder-chooser' hidden={!sources.length} value={fileId} onChange={event => {
        setFileId(event.target.selectedOptions[0].value);
      }}>{renderSourceOptions(sources)}</select>
      <ToolbarButton icon='clear-all' title='Clear' disabled={!source || !source.text} onClick={() => {
        window.dispatch({ event: 'clear' });
      }}></ToolbarButton>
    </Toolbar>
    <SplitView sidebarSize={200} sidebarHidden={mode === 'recording'}>
      <SourceView text={source.text} language={source.language} highlight={source.highlight} revealLine={source.revealLine}></SourceView>
      <div className='vbox'>
        <Toolbar>
          <ToolbarButton icon='microscope' title='Explore' toggled={mode === 'inspecting'} onClick={() => {
            window.dispatch({ event: 'setMode', params: { mode: mode === 'inspecting' ? 'none' : 'inspecting' } }).catch(() => { });
          }}>Explore</ToolbarButton>
          <input ref={selectorInputRef} className='selector-input' placeholder='Playwright Selector' value={selector} disabled={mode !== 'none'} onChange={event => {
            setSelector(event.target.value);
            window.dispatch({ event: 'selectorUpdated', params: { selector: event.target.value } });
          }} />
          <ToolbarButton icon='files' title='Copy' onClick={() => {
            copy(selectorInputRef.current?.value || '');
          }}></ToolbarButton>
        </Toolbar>
        <CallLogView log={Array.from(log.values())}/>
      </div>
    </SplitView>
  </div>;
};

function renderSourceOptions(sources: Source[]): React.ReactNode {
  const transformTitle = (title: string): string => title.replace(/.*[/\\]([^/\\]+)/, '$1');
  const renderOption = (source: Source): React.ReactNode => (
    <option key={source.id} value={source.id}>{transformTitle(source.label)}</option>
  );

  const hasGroup = sources.some(s => s.group);
  if (hasGroup) {
    const groups = new Set(sources.map(s => s.group));
    return Array.from(groups).map(group => (
      <optgroup label={group} key={group}>
        {sources.filter(s => s.group === group).map(source => renderOption(source))}
      </optgroup>
    ));
  }

  return sources.map(source => renderOption(source));
}

function copy(text: string) {
  const textArea = document.createElement('textarea');
  textArea.style.position = 'absolute';
  textArea.style.zIndex = '-1000';
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
}
