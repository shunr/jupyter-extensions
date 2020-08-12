import * as React from 'react';
import { Icon, Tooltip, IconButton, Portal } from '@material-ui/core';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { darcula } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import Toast from './toast';
import { Clipboard } from '@jupyterlab/apputils';

interface Props {
  code?: string;
  copy?: boolean;
}

interface State {
  copyAlertOpen: boolean;
}

export class CodeComponent extends React.Component<Props, null> {
  constructor(props: Props) {
    super(props);
  }

  render() {
    return (
      <div style={{ position: 'relative' }}>
        <SyntaxHighlighter language="python" style={darcula} wrapLines={true}>
          {this.props.children}
        </SyntaxHighlighter>
        <CopyCode
          copy={this.props.copy}
          code={this.props.children.toString()}
        />
      </div>
    );
  }
}

export class CopyCode extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      copyAlertOpen: false,
    };
  }

  render() {
    if (this.props.copy !== false) {
      return (
        <div>
          <Tooltip title="Copy">
            <IconButton
              size="small"
              onClick={_ => {
                Clipboard.copyToSystem(this.props.code);
                this.setState({ copyAlertOpen: true });
              }}
              style={{ position: 'absolute', top: '16px', right: '16px' }}
            >
              <Icon>content_copy</Icon>
            </IconButton>
          </Tooltip>
          <Portal>
            <Toast
              open={this.state.copyAlertOpen}
              message={'Code copied to clipboard'}
              autoHideDuration={4000}
              onClose={() => {
                this.setState({ copyAlertOpen: false });
              }}
            />
          </Portal>
        </div>
      );
    }
    return null;
  }
}
