// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { toArray } from '@phosphor/algorithm';
import { PanelLayout, Widget } from '@phosphor/widgets';
import { PathExt } from '@jupyterlab/coreutils';

import { Dialog } from '@jupyterlab/apputils';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { Contents } from '@jupyterlab/services';
import { IIconRegistry } from '@jupyterlab/ui-components';

import { GCSFileBrowser } from './browser';
import { FilterFileBrowserModel } from './model';
import { IGCSFileBrowserFactory } from './tokens';

/**
 * The class name added to open file dialog
 */
const OPEN_DIALOG_CLASS = 'jp-Open-Dialog';

/**
 * Namespace for file dialog
 */
export namespace FileDialog {
  /**
   * Options for the open directory dialog
   */
  export interface IDirectoryOptions
    extends Partial<
      Pick<
        Dialog.IOptions<Promise<Contents.IModel[]>>,
        Exclude<
          keyof Dialog.IOptions<Promise<Contents.IModel[]>>,
          'body' | 'buttons' | 'defaultButton'
        >
      >
    > {
    /**
     * An icon registry instance.
     */
    iconRegistry: IIconRegistry;

    /**
     * Document manager
     */
    manager: IDocumentManager;
  }

  /**
   * Options for the open file dialog
   */
  export interface IFileOptions extends IDirectoryOptions {
    /**
     * Filter function on file browser item model
     */
    filter?: (value: Contents.IModel) => boolean;
  }

  /**
   * Create and show a open files dialog.
   *
   * Note: if nothing is selected when `getValue` will return the browser
   * model current path.
   *
   * @param options - The dialog setup options.
   *
   * @returns A promise that resolves with whether the dialog was accepted.
   */
  export function getOpenFiles(
    options: IFileOptions
  ): Promise<Dialog.IResult<Contents.IModel[]>> {
    const dialogOptions: Partial<Dialog.IOptions<Contents.IModel[]>> = {
      title: options.title,
      buttons: [
        Dialog.cancelButton(),
        Dialog.okButton({
          label: 'Select',
        }),
      ],
      focusNodeSelector: options.focusNodeSelector,
      host: options.host,
      renderer: options.renderer,
      body: new OpenDialog(
        options.iconRegistry,
        options.manager,
        options.filter
      ),
    };
    const dialog = new Dialog(dialogOptions);
    return dialog.launch();
  }

  /**
   * Create and show a open directory dialog.
   *
   * Note: if nothing is selected when `getValue` will return the browser
   * model current path.
   *
   * @param options - The dialog setup options.
   *
   * @returns A promise that resolves with whether the dialog was accepted.
   */
  export function getExistingDirectory(
    options: IDirectoryOptions
  ): Promise<Dialog.IResult<Contents.IModel[]>> {
    return getOpenFiles({
      ...options,
      filter: model => false,
    });
  }
}

/**
 * Open dialog widget
 */
class OpenDialog extends Widget
  implements Dialog.IBodyWidget<Contents.IModel[]> {
  constructor(
    iconRegistry: IIconRegistry,
    manager: IDocumentManager,
    filter?: (value: Contents.IModel) => boolean
  ) {
    super();
    this.addClass(OPEN_DIALOG_CLASS);

    this._browser = Private.createFilteredFileBrowser(
      'filtered-file-browser-dialog',
      iconRegistry,
      manager,
      filter
    );

    // Build the sub widgets
    const layout = new PanelLayout();
    layout.addWidget(this._browser);

    // Set Widget content
    this.layout = layout;
  }

  /**
   * Get the selected items.
   */
  getValue(): Contents.IModel[] {
    const selection = toArray(this._browser.selectedItems());
    if (selection.length === 0) {
      // Return current path
      return [
        {
          path: this._browser.model.path,
          name: PathExt.basename(this._browser.model.path),
          type: 'directory',
          content: undefined,
          writable: false,
          created: 'unknown',
          last_modified: 'unknown',
          mimetype: 'text/plain',
          format: 'text',
        },
      ];
    } else {
      return selection;
    }
  }

  private _browser: GCSFileBrowser;
}

namespace Private {
  /**
   * Create a new file browser instance.
   *
   * @param id - The widget/DOM id of the file browser.
   *
   * @param iconRegistry - An icon registry instance.
   *
   * @param manager - A document manager instance.
   *
   * @param filter - function to filter file browser item.
   *
   * @param options - The optional file browser configuration object.
   *
   * #### Notes
   * The ID parameter is used to set the widget ID. It is also used as part of
   * the unique key necessary to store the file browser's restoration data in
   * the state database if that functionality is enabled.
   *
   * If, after the file browser has been generated by the factory, the ID of the
   * resulting widget is changed by client code, the restoration functionality
   * will not be disrupted as long as there are no ID collisions, i.e., as long
   * as the initial ID passed into the factory is used for only one file browser
   * instance.
   */
  export const createFilteredFileBrowser = (
    id: string,
    iconRegistry: IIconRegistry,
    manager: IDocumentManager,
    filter?: (value: Contents.IModel) => boolean,
    options: IGCSFileBrowserFactory.IOptions = {}
  ) => {
    const model = new FilterFileBrowserModel({
      iconRegistry,
      manager,
      filter,
      driveName: options.driveName,
      refreshInterval: options.refreshInterval,
    });
    const widget = new GCSFileBrowser({
      id,
      model,
    });

    return widget;
  };
}
