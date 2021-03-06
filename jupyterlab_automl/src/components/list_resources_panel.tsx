import { Box, Icon, IconButton, ListItem, Toolbar } from '@material-ui/core';
import blue from '@material-ui/core/colors/blue';
import orange from '@material-ui/core/colors/orange';
import green from '@material-ui/core/colors/green';
import red from '@material-ui/core/colors/red';
import * as React from 'react';
import { Dataset, DatasetService, DatasetType } from '../service/dataset';
import { Model, ModelService, ModelType } from '../service/model';
import { Context } from './automl_widget';
import {
  TextInput,
  SelectInput,
  ColumnType,
  ListResourcesTable,
  DialogComponent,
} from 'gcp_jupyterlab_shared';
import { ImportData } from './import_data';
import styled from 'styled-components';
import { debounce } from '../util';
import { DatasetWidget } from './dataset_widget';
import { ImageWidget } from './image_widget';
import { ModelWidget } from './model_widget';

interface Props {
  isVisible: boolean;
  width: number;
  height: number;
  context: Context;
}

enum ResourceType {
  Model = 'model',
  Dataset = 'dataset',
}

interface State {
  hasLoaded: boolean;
  isLoading: boolean;
  datasets: Dataset[];
  models: Model[];
  resourceType: ResourceType;
  searchString: string;
  importDialogOpen: boolean;
  deleteDialogOpen: boolean;
  deleteSubmitHandler: () => void;
  deleteTargetName: string;
}

const FullWidthInput = styled(Box)`
  width: 100%;
  & > div {
    width: 100%;
  }
`;

const ResourceSelect = styled(Box)`
  & > div {
    padding: 0;
    margin: 4px 0;
  }
`;

const styles = {
  toolbar: {
    paddingLeft: 16,
    paddingRight: 16,
    minHeight: 0,
  },
  select: {
    fontSize: 'var(--jp-ui-font-size0)',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  selectItem: {
    fontSize: 'var(--jp-ui-font-size1)',
  },
  icon: {
    fontSize: 20,
  },
};

const breakpoints = [250, 380];

export class ListResourcesPanel extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasLoaded: false,
      isLoading: false,
      datasets: [],
      models: [],
      resourceType: ResourceType.Dataset,
      searchString: '',
      deleteDialogOpen: false,
      deleteSubmitHandler: null,
      deleteTargetName: '',
      importDialogOpen: false,
    };
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    // Reduce the number of rerenders when resizing the width by only triggering
    // a render if the new width crosses a column breakpoint
    let shouldUpdate =
      this.props.isVisible !== nextProps.isVisible ||
      this.state !== nextState ||
      this.props.height !== nextProps.height;
    for (const bp of breakpoints) {
      shouldUpdate =
        shouldUpdate ||
        Math.sign(this.props.width - bp) !== Math.sign(nextProps.width - bp);
    }
    return shouldUpdate;
  }

  componentDidUpdate(prevProps: Props) {
    const isFirstLoad =
      !(this.state.hasLoaded || prevProps.isVisible) && this.props.isVisible;
    if (isFirstLoad) {
      this.refresh();
    }
  }

  render() {
    // TODO: Make styles separate
    return (
      <>
        <Box height={1} width={1} bgcolor={'white'} borderRadius={0}>
          <Toolbar variant="dense" style={styles.toolbar}>
            <ResourceSelect>
              <SelectInput
                value={this.state.resourceType}
                options={[
                  { text: 'Models', value: ResourceType.Model },
                  { text: 'Datasets', value: ResourceType.Dataset },
                ]}
                onChange={event => {
                  if (this.state.isLoading) return;
                  this.selectType(event.target.value as ResourceType);
                }}
              />
            </ResourceSelect>
            <Box flexGrow={1}></Box>
            <IconButton
              style={styles.icon}
              size="small"
              onClick={_ => {
                this.setState({ importDialogOpen: true });
              }}
            >
              <Icon>add</Icon>
            </IconButton>
            <IconButton
              disabled={this.state.isLoading}
              size="small"
              onClick={_ => {
                this.refresh();
              }}
            >
              <Icon>refresh</Icon>
            </IconButton>
          </Toolbar>
          <Toolbar variant="dense" style={styles.toolbar}>
            <FullWidthInput width={1}>
              <TextInput
                placeholder="Search"
                type="search"
                onChange={event => {
                  this.handleSearch(event.target.value);
                }}
              />
            </FullWidthInput>
          </Toolbar>
          {this.state.resourceType === ResourceType.Dataset ? (
            <ListResourcesTable
              columns={[
                {
                  field: 'datasetType',
                  title: '',
                  render: rowData =>
                    this.iconForDatasetType(rowData.datasetType),
                  fixedWidth: 30,
                  sorting: false,
                },
                {
                  field: 'displayName',
                  title: 'Name',
                },
                {
                  title: 'Created at',
                  field: 'createTime',
                  type: ColumnType.DateTime,
                  render: rowData => {
                    return <p>{rowData.createTime.toLocaleString()}</p>;
                  },
                  rightAlign: true,
                  minShowWidth: breakpoints[0],
                },
              ]}
              data={this.filterResources<Dataset>(this.state.datasets)}
              onRowClick={rowData => {
                if (rowData.datasetType === 'TABLE') {
                  this.props.context.manager.launchWidgetForId(
                    DatasetWidget,
                    rowData.id,
                    rowData
                  );
                } else {
                  this.props.context.manager.launchWidgetForId(
                    ImageWidget,
                    rowData.id,
                    rowData
                  );
                }
              }}
              isLoading={this.state.isLoading}
              height={this.props.height - 80}
              width={this.props.width}
              rowContextMenu={[
                {
                  label: 'Delete',
                  handler: rowData => {
                    this.deleteConfirm(rowData);
                  },
                },
              ]}
            />
          ) : (
            <ListResourcesTable
              columns={[
                {
                  field: 'displayName',
                  title: '',
                  render: rowData => this.iconForModelType(rowData.modelType),
                  fixedWidth: 30,
                  sorting: false,
                },
                {
                  field: 'displayName',
                  title: 'Name',
                },
                {
                  title: 'Last updated',
                  field: 'updateTime',
                  type: ColumnType.DateTime,
                  render: rowData => {
                    return <p>{rowData.updateTime.toLocaleString()}</p>;
                  },
                  rightAlign: true,
                  minShowWidth: breakpoints[0],
                },
              ]}
              data={this.filterResources<Model>(this.state.models)}
              isLoading={this.state.isLoading}
              height={this.props.height - 80}
              width={this.props.width}
              rowContextMenu={[
                {
                  label: 'Delete',
                  handler: rowData => {
                    this.deleteConfirm(rowData);
                  },
                },
              ]}
              onRowClick={rowData => {
                this.props.context.manager.launchWidgetForId(
                  ModelWidget,
                  rowData.id,
                  rowData
                );
              }}
            />
          )}
          <DialogComponent
            open={this.state.deleteDialogOpen}
            header={`Are you sure you want to delete ${this.state.deleteTargetName}?`}
            onCancel={this.toggleDelete}
            onClose={this.toggleDelete}
            onSubmit={this.state.deleteSubmitHandler}
            submitLabel={'Ok'}
          />
          <ImportData
            open={this.state.importDialogOpen}
            onClose={() => {
              this.setState({ importDialogOpen: false });
            }}
            onSuccess={() => {
              this.refresh();
            }}
          />
        </Box>
      </>
    );
  }

  private deleteConfirm = rowData => {
    this.setState({ deleteTargetName: rowData.displayName });
    if (this.state.resourceType === ResourceType.Dataset) {
      this.setState({
        deleteSubmitHandler: () => {
          DatasetService.deleteDataset(rowData.id);
          this.refresh();
          this.toggleDelete();
        },
      });
    } else if (this.state.resourceType === ResourceType.Model) {
      this.setState({
        deleteSubmitHandler: () => {
          ModelService.deleteModel(rowData.id);
          this.refresh();
          this.toggleDelete();
        },
      });
    } else {
      this.setState({
        deleteSubmitHandler: null,
      });
    }
    this.toggleDelete();
  };

  private toggleDelete = () => {
    this.setState({
      deleteDialogOpen: !this.state.deleteDialogOpen,
    });
  };

  private iconForDatasetType(datasetType: DatasetType) {
    const icons: { [key in DatasetType]: any } = {
      OTHER: {
        icon: 'error',
        color: red[900],
      },
      TABLE: {
        icon: 'table_chart',
        color: blue[700],
      },
      IMAGE: {
        icon: 'image',
        color: orange[500],
      },
    };
    return (
      <ListItem dense style={{ padding: 0 }}>
        <Icon style={{ ...styles.icon, color: icons[datasetType].color }}>
          {icons[datasetType].icon}
        </Icon>
      </ListItem>
    );
  }

  private iconForModelType(modelType: ModelType) {
    const icons: { [key in ModelType]: any } = {
      OTHER: {
        icon: 'emoji_objects',
        color: green[500],
      },
      TABLE: {
        icon: 'emoji_objects',
        color: blue[700],
      },
      IMAGE: {
        icon: 'emoji_objects',
        color: orange[500],
      },
    };
    return (
      <ListItem dense style={{ padding: 0 }}>
        <Icon style={{ ...styles.icon, color: icons[modelType].color }}>
          {icons[modelType].icon}
        </Icon>
      </ListItem>
    );
  }

  private handleSearch = debounce((value: string) => {
    this.setState({ searchString: value });
  }, 250);

  private filterResources<T>(resources: T[]): T[] {
    const searchFields = {
      displayName: true,
      updateTime: true,
      createTime: true,
      datasetType: true,
    };
    return resources.filter(x => {
      if (!this.state.searchString) return true;
      const obj = x as { [k: string]: any };
      for (const key in x) {
        if (!(key in searchFields)) continue;
        if (
          typeof obj[key] === 'string' &&
          (obj[key] as string)
            .toLowerCase()
            .includes(this.state.searchString.toLowerCase())
        ) {
          return true;
        }
        if (
          obj[key] instanceof Date &&
          (obj[key] as Date)
            .toLocaleString()
            .toLowerCase()
            .includes(this.state.searchString.toLowerCase())
        ) {
          return true;
        }
      }
      return false;
    });
  }

  private selectType(type: ResourceType) {
    this.setState({ resourceType: type });
    this.refresh();
  }

  private async refresh() {
    try {
      this.setState({ isLoading: true });
      await Promise.all([this.getDatasets(), this.getModels()]);
      this.setState({ hasLoaded: true });
    } catch (err) {
      console.warn('Error retrieving datasets', err);
    } finally {
      this.setState({ isLoading: false });
    }
  }

  private async getDatasets() {
    try {
      const datasets = await DatasetService.listDatasets();
      this.setState({ datasets: datasets });
    } catch (e) {
      console.log('Failed to load dataset resource.');
    }
  }

  private async getModels() {
    try {
      const models = await ModelService.listModels();
      this.setState({ models: models });
    } catch (e) {
      console.log('Failed to load models resource.');
    }
  }
}
