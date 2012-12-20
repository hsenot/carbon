// Optimise the loading of the required libraries
// Fetch them actively rather than on discovery
// To be reworked precisely
Ext.require([
	'Ext.Viewport',
	'Ext.grid.*',
	'Ext.data.*',
	'Ext.util.*',
	'Ext.state.*',
	'Ext.form.*'
]);

// And here the map creation
var map, layer, wfs, wms, selectCtrl, propagate=true, fullStrEltStore,origin="map";

var styleMapLabelDS;
 
function set_styleMapLabelDS()
{
// Labelling on the client side does not work well - no collision detection
    var template = {
//        strokeColor: "#0000FF",
        strokeOpacity: 0,
//        strokeWidth: 3,
//        fillColor: "#00AAFF",
        fillOpacity: 0,
//        label : "${legacy_id}",
//        fontColor: "red",
//        fontSize: 10,
//        fontFamily: "Arial",
//        fontWeight: "bold"
//        ,labelAlign: "lb"
    };
    var templateB = {
        strokeColor: "#FF00FF",
        strokeOpacity: 1,
        strokeWidth: 3,
        fillColor: "#AA00FF",
        fillOpacity: 0.1,
//        label : "${legacy_id}",
//        fontColor: "blue",
//        fontSize: 10,
//        fontFamily: "Arial",
//        fontWeight: "bold"
//        ,labelAlign: "lb"
    };
    styleMapLabelDS = new OpenLayers.StyleMap( { "default" : new OpenLayers.Style(template), "select" : new OpenLayers.Style(templateB) } );

}
 
set_styleMapLabelDS();

Ext.onReady(function () {
	Ext.override(Ext.data.Store, {
		setExtraParam: function (name, value){
			this.proxy.extraParams = this.proxy.extraParams || {};
			this.proxy.extraParams[name] = value;
			this.proxy.applyEncoding(this.proxy.extraParams);
		}
	});

	Ext.create('Ext.Viewport', {
		layout: {
			type: 'border',
			padding: 3
		},
		defaults: {
			split: true
		},
		items: [{
			region: 'west',
			collapsible: true,
			title: 'Feeds',
			width: 250,
			layout: {
				type: 'vbox',
				align: 'stretch'
			},
			items: [{
				title: 'Filter by',
				height: 100,
				layout: {
					type: 'vbox',
					align: 'stretch'
				},
				items: [
					{
						xtype: 'component',
						id: 'comboActivityType',
						flex: 1,
						padding: 3
					},
					{
						xtype: 'component',
						id: 'comboStructureElement',
						flex: 1,
						padding: 3
					},
				]
			}, {
//				title: 'Feed list',
				height: 258,
				layout: 'fit',
				items:[
					{
						xtype: 'component',
						id: 'gridFeed'
					}
				]
			}, {
				title: 'Feed details',
				flex: 1,
				autoScroll: true,
				layout: 'fit',
				items:[
					{
						xtype: 'component',
						id: 'formFeed'
					}
				]
			}]
		}, {
			region: 'center',
			width: '100%',
			layout: {
				type: 'vbox',
				align: 'stretch'
			},
			items: [{
				html: '<div id=\'coords\'></div>',
				title: 'Search',
//				layout: 'fit',
				layout: {
					type: 'hbox',
					pack: 'start',
					align: 'stretch'
				},
				height: 100,
				items:[
				{ flex:1,border: false},
					{
						xtype:'component',
						id:'comboSearch',
						padding: "20px",
						border: false,
						width: 500,
//						height: 36,
//						bodyStyle: " background-color: white ; "
					},
					{ flex:1,border: false}
				]
			}, {
				html: '<div id=\'map\'></div>',
				title: 'Map',
				flex: 1
			}]
		}, {
			region: 'east',
			collapsible: true,
			floatable: true,
			split: true,
			width: 250,
			title: 'Activity data',
			layout: {
				type: 'vbox',
				align: 'stretch'
			},
			items: [{
				title: 'History',
				height: 358,
				layout: 'fit',
				items:[
					{
						xtype: 'component',
						id: 'gridData'
					}
				]
			},{
				title: 'Activity data details',
				flex: 1,
				autoScroll: true,
				layout: 'fit',
				items:[
					{
						xtype: 'component',
						id: 'formData'
					}
				]
			}]

		}]
	});

	Ext.define("ActivityType", {extend: "Ext.data.Model",	
		fields: [
			{type: 'string', name: 'id', mapping: 'row.id'},
			{type: 'string', name: 'label', mapping: 'row.label'},
			{type: 'string', name: 'iconcls', mapping: 'row.iconcls'}
			// only the relevant columns are listed in the model
		]
	});

	Ext.define("StructureElementByHierarchy", {extend: "Ext.data.Model",	
		fields: [
			{type: 'string', name: 'id', mapping: 'row.id'},
			{type: 'string', name: 'label', mapping: 'row.label'},
			{type: 'string', name: 'physical', mapping: 'row.physical'},
			{type: 'string', name: 'structure_element_id', mapping: 'row.structure_element_id'},
			// only the relevant columns are listed in the model
		]
	});

	Ext.define("Feed", {extend: "Ext.data.Model",	
		fields: [
			{type: 'string', name: 'id', mapping: 'row.id'},
			{type: 'string', name: 'label', mapping: 'row.label'},
			{type: 'string', name: 'structure_element_id', mapping: 'row.structure_element_id'},
			{type: 'string', name: 'type_id', mapping: 'row.type_id'},
			// only the relevant columns are listed in the model
		]
	});

	Ext.define("ActivityData", {extend: "Ext.data.Model",	
		idProperty: 'id',
		fields: [
			{type: 'string', name: 'id', mapping: 'row.id'},
			{type: 'string', name: 'value', mapping: 'row.value'},
			{type: 'date', name: 'start_date', mapping: 'row.start_date'},
			{type: 'date', name: 'end_date', mapping: 'row.end_date'},
			// only the relevant columns are listed in the model
		]
	});


	// The data store holding the activity types
	var store_activity_type = Ext.create('Ext.data.Store', {
		autoLoad:true,
		model: 'ActivityType',
		proxy: {
			type: 'rest',
			url : '/ws/rest/activity/r_type.php',
			reader: {
				type: 'json',
				root: 'rows'
			}
		},
		listeners: {
			load: function(ds,records,o) {
				var cb = Ext.getCmp('comboActivityType');
				// Loading electricity as the default - its id is 1
				if (cb.getValue() == undefined)
				{
					var rec = records[0];
//				cb.setValue(rec.data.id);
					cb.setValue("1");
				}				
				//cb.fireEvent('select',cb,rec);
			},
			scope: this	
		},
		sorters: [ { property: 'label', direction: 'ASC' } ]
	});

	// The data store holding the structure elements
	var store_str_elt_by_hierarchy = Ext.create('Ext.data.Store', {
		autoLoad:false,
		model: 'StructureElementByHierarchy',
		proxy: {
			type: 'rest',
			// Embedded in this approach is the ID of the structure
			url : '/ws/rest/structure/r_element_by_hierarchy.php?structure_id=1',
			reader: {
				type: 'json',
				root: 'rows'
			}
		},
//		sorters: [ { property: 'label', direction: 'ASC' } ]
	});
	
	
	var store_str_elt_by_hierarchy_full = Ext.create('Ext.data.Store', {
		autoLoad:false,
		model: 'StructureElementByHierarchy',
		proxy: {
			type: 'rest',
			// Embedded in this approach is the ID of the structure
			url : '/ws/rest/structure/r_element_by_hierarchy.php?structure_id=1',
			reader: {
				type: 'json',
				root: 'rows'
			}
		},
//		sorters: [ { property: 'label', direction: 'ASC' } ]
	});
	
	
	// The data store holding the activity data
	var store_data = Ext.create('Ext.data.Store', {
		autoLoad:false,
		remoteSort: true,
		model: 'ActivityData',
		pageSize: 12,
		proxy: {
			type: 'rest',
			url : '/ws/rest/activity/r_data.php',
			reader: {
				type: 'json',
				root: 'rows',
				totalProperty: 'total_rows',
				idProperty: 'id'
			}
		},
		sorters: [ { property: 'start_date', direction: 'DESC' } ]
	});

	// The data store holding the feeds
	var store_feed = Ext.create('Ext.data.Store', {
		autoLoad:false,
		model: 'Feed',
		proxy: {
			type: 'rest',
			url : '/ws/rest/activity/r_feed.php',
			reader: {
				type: 'json',
				root: 'rows'
			}
		}
	});
	
	var full_clear_feed_and_data = function(){
		// We need to clear the activity grid and the activity data details form
		store_data.removeAll();

		// Disabling both the create and the update buttons
		Ext.getCmp('form_data_button_create').disable();	
		Ext.getCmp('form_data_button_update').disable();
		Ext.getCmp('form_data_button_delete').disable();

		// Disabling the form from further updates
		Ext.getCmp('form_data').disable();

		// Disabling both the create and the update buttons
		Ext.getCmp('form_feed_button_create').disable();	
		Ext.getCmp('form_feed_button_update').disable();

		// Disabling the form from further updates
		Ext.getCmp('form_feed').disable();	
		
		// We auto-select the feed if there is only one
		var l = store_feed.data.length;
		if (l == 1)
		{
			var fg = Ext.getCmp('feedGrid');
			fg.getSelectionModel().select(0);
		}
	};

	
	store_feed.addListener('load', full_clear_feed_and_data);
	store_feed.addListener('remove', full_clear_feed_and_data);

	store_activity_type.load();
	store_str_elt_by_hierarchy.load();
	store_str_elt_by_hierarchy_full.load();
	
	var comboActivityType = Ext.create('Ext.form.field.ComboBox', {
//	var comboActivityType = Ext.create('Ext.ux.IconCombo', {
		id: 'comboActivityType',
		fieldLabel: 'Activity',
//		forceSelection: true,
		editable: false,
		allowBlank: false,
		renderTo: 'comboActivityType',
		displayField: 'label',
		valueField: 'id',
//		iconClsField: 'iconcls',
		triggerAction: 'all',
		typeAhead: true,
		width: 240,
		tpl: '<tpl for="."><div class="x-boundlist-item x-icon-combo-item {iconcls}">{label}</div></tpl>',
//		itemSelector: 'div.info-item',		
		labelWidth: 45,
		store: store_activity_type,
		listeners: {
			select: function(combo, record, index) {
				// Retrieving value from structure element combobox
				var current_str_elt = Ext.getCmp('comboStrEltByHierarchy').getValue();
				// Only loading the feeds if there is a location selected
				if (current_str_elt)
				{
					store_feed.load({params:{type_id:combo.getValue(), structure_element_id:current_str_elt}});
				}
				else
				{
					// It means that the feed store should be cleared
					store_feed.removeAll();					
//					store_feed.fireEvent('remove',store_feed);
				}
			}			
		}
	});
	
	var comboStrEltByHierarchy = Ext.create('Ext.form.field.ComboBox', {
		id: 'comboStrEltByHierarchy',
		fieldLabel: 'Location',
		forceSelection: true,
		editable:false,
		queryParam: 'query',
		minChars: 1,
//		allowBlank: true,
		renderTo: 'comboStructureElement',
		displayField: 'label',
		disabled: true,
		valueField: 'id',
		width: 240,
//		tpl: '<tpl for="."><div class="search-item" style="height: 28px;"><font color="#666666">{id}</font> : {label} <br></div></tpl>',
//		itemSelector: 'div.search-item',
		labelWidth: 45,
		store: store_str_elt_by_hierarchy,
		listeners: {
			select: function(combo, record, index) {
				var feature;
				// To execute only if record[0] is not null - that a sign that the click comes from the map (as opposed to a direct combo selection)
				// It is unclear why this is
//				if (record[0])
				if (origin=="search")
				{
					// We want just have the feature selected but not trigger the select event
					// Using highlight was not enough so we use a global variable to shortcut the additional processsing done by the select control on select
					propagate = false;
					// Highlighting the structure element (highlight only, to avoid triggering a select event on the wfs layer) the corresponding feature
					for(f in wfs.features) {
						feature = wfs.features[f];
//						if(feature.fid.replace(/building\./,"") == record[0].data.id){
//						if(feature.data.id == record[0].data.id){
						if(feature.data.id == combo.getValue()){
							selectCtrl.select(feature);
						}
						else
						{
							selectCtrl.unselect(feature);
						}
					} 
					propagate = true;
				}				
				// Retrieving value from the activity type combobox
				var current_activity_type = Ext.getCmp('comboActivityType').getValue();
				// Only loading the feeds if the structure element is provided
				if (combo.getValue())
				{
					store_feed.load({params:{type_id:current_activity_type,structure_element_id:combo.getValue()}});
				}
				else
				{
					// It means that the feed store should be cleared
					store_feed.removeAll();
//					store_feed.fireEvent('remove',store_feed);
				}
			}
		}
	});	
	
	var comboSearchHierarchy = Ext.create('Ext.form.field.ComboBox', {
		id: 'comboSearchHierarchy',
		emptyText: 'Search for location',
		forceSelection: false,
		editable:true,
		typeAhead: false,
		hideTrigger: true,
//		height: "26px",
		style: "border: 2px solid #BBBBBB; font-size: 11pt;",
		queryParam: 'query',
		minChars: 1,
		allowBlank: true,
		renderTo: 'comboSearch',
		displayField: 'label',
		valueField: 'id',
		width: 400,
//		tpl: '<tpl for="."><div class="search-item" style="height: 28px;"><font color="#666666">{id}</font> : {label} <br></div></tpl>',
//		itemSelector: 'div.search-item',
//		labelWidth: 70,
		store: store_str_elt_by_hierarchy_full,
		listeners: {
			select: function(combo, record, index) {
					origin="search";
					var id_clicked = record[0].data.id;
					comboStrEltByHierarchy.select(id_clicked);
					// It is necessary to trigger the select event
					comboStrEltByHierarchy.fireEvent('select',comboStrEltByHierarchy);
			}
		}
	});	
	
	

	var feedGrid = Ext.create('Ext.grid.Panel', {
		store: store_feed,
		stateful: true,
		id:'feedGrid',
		stateId: 'feedGrid',
		columns: [
			{
				text     : 'Feed list',
				flex     : 1,
				sortable : true, 
				dataIndex: 'label'
			}
		],
		renderTo: 'gridFeed',
		height:'256',
		viewConfig: {
			stripeRows: true
		},
		dockedItems:[{
			xtype: 'toolbar',
			dock: 'bottom',
			displayInfo: true,
			items:['->',
			{
				xtype: 'button',
				iconCls: 'add',
				text: 'Create new feed ...',
				handler:function(){
					var f = Ext.getCmp('form_feed');
					// Enabling the form in create mode
					f.enable();
					f.getForm().reset();
					// ID field still to be disabled
					f.getForm().findField('feed_id').disable();
					// Enable create button, disable update button
					Ext.getCmp('form_feed_button_create').enable();
				}
			}]
		},{
			xtype: 'pagingtoolbar',
			store: store_feed,
			dock: 'bottom',
			displayInfo: true,
			pageSize:8
		}
		]
		
	});
	
	feedGrid.getSelectionModel().on('selectionchange', function(sm, selectedRecord) {
		if (selectedRecord.length) {
			var feed_id = selectedRecord[0].data.id;
			load_feed_form(feed_id);
			store_data.setExtraParam('feed_id',feed_id);
			store_data.setExtraParam('mode','form-rp');
			store_data.load();
//			store.loadPage(1);
//			store_data.load({params:{feed_id:feed_id}});
			var f = Ext.getCmp('form_feed');
			// Enabling the form in update mode
			f.enable();
			// ID field still to be disabled
			f.getForm().findField('feed_id').disable();
			// Enable update button, disable create button
			Ext.getCmp('form_feed_button_update').enable();
		}
	});
	
	
	var formPanel = Ext.create('Ext.form.Panel', {
		renderTo: 'formFeed',
		id:'form_feed',
		frame: true,
		disabled: true,
//		width: 225,
		bodyPadding: 5,
		waitMsgTarget: true,
		monitorValid:true,

		fieldDefaults: {
			labelAlign: 'left',
			labelWidth: 45,
			msgTarget: 'side',
		},

		items: [{
			xtype: 'field',
			fieldLabel: 'Id',
			id:'feed_id',
			name: 'id',
			disabled: true
		},{
			xtype: 'field',
			fieldLabel: 'Label',
			name: 'label'	
		},{
			xtype: 'combobox',
			name:'type_id',
			fieldLabel: 'Activity',
			displayField: 'label',
			valueField: 'id',
			store: store_activity_type
		},{
			xtype: 'combobox',
			name:'structure_element_id',
			fieldLabel: 'Linked to',
			displayField: 'label',
			valueField: 'id',
			store: store_str_elt_by_hierarchy
		},{
			xtype: 'checkbox',
			fieldLabel: 'Meter?',
			name: 'meter'	
		}],

		buttons: [{
			text: 'Create',
			id:'form_feed_button_create',
			disabled: true,
			formBind: true,
			handler: function(){
				this.up('form').getForm().submit({
					url: '/ws/rest/activity/r_feed.php?mode=form-c',
					submitEmptyText: false,
					waitMsg: 'Saving ...',
					success: reload_form_feed
				});
			}
		},{
			text: 'Update',
			disabled: true,
			id:'form_feed_button_update',
			formBind: true,
			handler: function(){
				this.up('form').getForm().submit({
					url: '/ws/rest/activity/r_feed.php?id='+Ext.getCmp('feed_id').getValue()+'&mode=form-u',
					submitEmptyText: false,
					waitMsg: 'Saving ...',
					success: reload_form_feed
				});
			}
		},{
			text: 'Cancel',
			scope: this,
//			disabled:true,
			handler: function(){
				var id=Ext.getCmp('feed_id').getValue();
				if (id)
				{
					load_feed_form(id);			
				}
				else
				{
					// Clear all values in the form
					this.reset;	
				}
				// Disabling both the create and the update buttons
				Ext.getCmp('form_feed_button_create').disable();	
				Ext.getCmp('form_feed_button_update').disable();
				// Disabling the form from further updates
				Ext.getCmp('form_feed').disable();
			}			
		}]
	});	

	var reload_form_feed = function(f,a){
		if (a.result.data)
		{
			// Case if we are creating a record, because of the ID returned by the web service
			load_feed_form(a.result.data.id);
		}
		else
		{
			// If not (=updating an existing record), the ID is already there and has not changed
			load_feed_form(Ext.getCmp('feed_id').getValue());
		}
		// Disabling both the create and the update buttons
		Ext.getCmp('form_feed_button_create').disable();	
		Ext.getCmp('form_feed_button_update').disable();

		// Disabling the form from further updates
		Ext.getCmp('form_feed').disable();
		
		// Reload parameters for the feed grid
		var current_activity_type = Ext.getCmp('comboActivityType').getValue();
		var current_str_elt = Ext.getCmp('comboStrEltByHierarchy').getValue();
		// Refreshes the data grid by reloading the underlying store (if there is a selected location)
		// This avoids to load all the feeds if the location has not been entered
		if (current_str_elt)
		{
			store_feed.load({params:{type_id:current_activity_type,structure_element_id:current_str_elt}});
		}
	};
	
	var load_feed_form = function(i){
		formPanel.getForm().load({
			url: '/ws/rest/activity/r_feed.php?id='+i+'&mode=form-r',
			waitMsg: 'Loading ...'
		});
	};
	

	var dataGrid = Ext.create('Ext.grid.Panel', {
		store: store_data,
		id:'grid_data',
//		stateful: true,
//		stateId: 'dataGrid',
		columns: [
			{
				text     : 'Id',
				width    : 25,
				sortable : true, 
				dataIndex: 'id'
			},
			{
				text     : 'Value',
				flex     : 2,
				sortable : true, 
				dataIndex: 'value',
				renderer: Ext.util.Format.numberRenderer('0.00')
			},
			{
				text     : 'Start',
				flex     : 2,
				sortable : true, 
				dataIndex: 'start_date',
				renderer : Ext.util.Format.dateRenderer('d/m/Y')
			},
			{
				text     : 'End',
				flex     : 2,
				sortable : true, 
				dataIndex: 'end_date',
				renderer : Ext.util.Format.dateRenderer('d/m/Y')
				}
		],
		renderTo: 'gridData',
		height: 331,
//		viewConfig: {
//			stripeRows: true
//		},
		dockedItems:[{
			xtype: 'toolbar',
			dock: 'bottom',
			displayInfo: true,
			items:['->',
			{
				xtype: 'button',
				iconCls: 'add',
				text: 'Create new activity ...',
				handler:function(){
					// If no feed selected, prompt user to
					if (Ext.getCmp('feed_id').getValue())
					{
						var f = Ext.getCmp('form_data');
						// Enabling the form in create mode
						f.enable();
						f.getForm().reset();
						// ID field still to be disabled
						f.getForm().findField('data_id').disable();
						// Enable create button, disable update button
						Ext.getCmp('form_data_button_create').enable();
						Ext.getCmp('form_data_button_update').disable();
						Ext.getCmp('form_data_button_delete').disable();
					}
					else
					{
						alert("Please select a feed to attach activity data to.");
					}
				}
			}]
		},{
			xtype: 'pagingtoolbar',
			store: store_data,
			dock: 'bottom',
			displayInfo: true,
			pageSize:12
		}
		]

	});
	
	dataGrid.getSelectionModel().on('selectionchange', function(sm, selectedRecord) {
		if (selectedRecord.length) {
			var data_id = selectedRecord[0].data.id;
			load_data_form(data_id);
			var f = Ext.getCmp('form_data');
			// Enabling the form in update mode
			f.enable();
			// ID field still to be disabled
			f.getForm().findField('data_id').disable();
			// Enable update button, disable create button
			Ext.getCmp('form_data_button_create').disable();
			Ext.getCmp('form_data_button_update').enable();
			Ext.getCmp('form_data_button_delete').enable();
		}
	});
	

	var dataFormPanel = Ext.create('Ext.form.Panel', {
		renderTo: 'formData',
		id:'form_data',
		frame: true,
		disabled: true,
//		width: 225,
		bodyPadding: 5,
		waitMsgTarget: true,

		fieldDefaults: {
			labelAlign: 'left',
			labelWidth: 45,
			msgTarget: 'side'
		},

		items: [{
			xtype: 'field',
			fieldLabel: 'Id',
			id:'data_id',
			name: 'id',
			disabled: true
		},{
			xtype: 'numberfield',
			fieldLabel: 'Value',
			name: 'value',
			decimalPrecision:2,
			// Hides the spinner - maybe to be restored?
			hideTrigger:true
		},{
			xtype: 'datefield',
			fieldLabel: 'Start',
			name: 'start_date',
			format:'d/m/Y'
		},{
			xtype: 'datefield',
			fieldLabel: 'End',
			name: 'end_date',
			format:'d/m/Y'	
		}],

			
		buttons: [{
			text: 'Create',
			id:'form_data_button_create',
			minWidth: 50,
			width: 50,
			disabled: true,
			formBind: true,
			handler: function(){
				this.up('form').getForm().submit({
					url: '/ws/rest/activity/r_data.php?feed_id='+Ext.getCmp('feed_id').getValue()+'&mode=form-c',
					submitEmptyText: false,
					waitMsg: 'Saving ...',
					success: reload_form_data
				});
			}
		},{
			text: 'Update',
			disabled: true,
			minWidth: 50,
			width: 50,
			id:'form_data_button_update',
			formBind: true,
			handler: function(){
				this.up('form').getForm().submit({
					url: '/ws/rest/activity/r_data.php?id='+Ext.getCmp('data_id').getValue()+'&mode=form-u',
					submitEmptyText: false,
					waitMsg: 'Saving ...',
					success: reload_form_data
				});
			}
		},{
			text: 'Delete',
			disabled: true,
			minWidth: 50,
			width: 50,
			id:'form_data_button_delete',
			formBind: true,
			handler: function(){
				this.up('form').getForm().submit({
					url: '/ws/rest/activity/r_data.php?id='+Ext.getCmp('data_id').getValue()+'&mode=form-d',
					submitEmptyText: false,
					waitMsg: 'Deleting ...',
					success: reload_form_data
				});
			}
		},{
			text: 'Cancel',
			scope: this,
			minWidth: 50,
			width: 50,
//			disabled:true,
			handler: function(){
				var id=Ext.getCmp('data_id').getValue();
				if (id)
				{
					load_data_form(id);			
				}
				else
				{
					// Clear all values in the form
					this.reset;	
				}
				// Disabling both the create and the update buttons
				Ext.getCmp('form_data_button_create').disable();	
				Ext.getCmp('form_data_button_update').disable();
				Ext.getCmp('form_data_button_delete').disable();
				// Disabling the form from further updates
				Ext.getCmp('form_data').disable();
			}			
		}]
	});
	
	var reload_form_data = function(f,a){
		var form_data_id = Ext.getCmp('data_id').getValue();
		if (a.result.data)
		{
			// Case if we are creating a record, because of the ID returned by the web service
			load_data_form(a.result.data.id);
		}
		else 
		{
			if (form_data_id)
				{
					// If not (=updating an existing record), the ID is already there and has not changed
					load_data_form(form_data_id);
				}
				else
				{
					// We've deleted the record, the form just needs to be reset
					f.getForm().reset();
				}
		}
		// Disabling both the create and the update buttons
		Ext.getCmp('form_data_button_create').disable();	
		Ext.getCmp('form_data_button_update').disable();
		Ext.getCmp('form_data_button_delete').disable();

		// Disabling the form from further updates
		Ext.getCmp('form_data').disable();
		// Refreshes the data grid by reloading the underlying store
		store_data.load();
		
		// Refreshes the WMS layer as its aspect may have changed
		wms.mergeNewParams({'thisIsAUniqueName': Math.random()});
		
	};
	
	var load_data_form = function(i){
		dataFormPanel.getForm().load({
			url: '/ws/rest/activity/r_data.php?id='+i+'&mode=form-r',
			waitMsg: 'Loading ...'
		});
	};
	
	function init(){

		OpenLayers.ProxyHost = "/geoexplorer/proxy?url=";

		var maxExtent = new OpenLayers.Bounds(-20037508, -20037508, 20037508, 20037508),
			restrictedExtent = maxExtent.clone(),
			maxResolution = 156543.0339;
    
		var options = {
			projection: new OpenLayers.Projection("EPSG:900913"),
			displayProjection: new OpenLayers.Projection("EPSG:4326"),
			units: "m",
			numZoomLevels: 18,
			maxResolution: maxResolution,
			maxExtent: maxExtent,
			restrictedExtent: restrictedExtent
		};
		map = new OpenLayers.Map('map', options);

		map.addControl(new OpenLayers.Control.MousePosition());

		var basemap = new OpenLayers.Layer.OSM( "Simple OSM Map");
		
//		basemap.transitionEffect = 'resize';		
		basemap.opacity=0.4;
		
		// Should it be several WFS layers with different objects at different scales?
		// Or a single WMS layer where the level is used to render different features at different levels? or different opacity at different levels?
		// Should it be on the structure element or on the structure element hierarchy or on a view combining geometry from the structure element table and hierarchy from the hierarchy table?
		// To sort out before starting to plug the map controls - after that, it becomes messy. Keep in mind the genericty of the long-term goal but the realistic approach of a short term prototype

		wfs = new OpenLayers.Layer.Vector("Buildings", {
			strategies: [new OpenLayers.Strategy.BBOX()],
				protocol: new OpenLayers.Protocol.WFS({
				url: "/geoserver/wfs",
				featureType: "structure_element_electricity",
				featureNS: "http://www.unimelb.edu.au"
			}),
//			renderers: ["VML"],
			styleMap: styleMapLabelDS,
			projection: new OpenLayers.Projection("EPSG:4326")
		});
		wfs.transitionEffect = 'resize';


		wms = new OpenLayers.Layer.WMS(
			"Buildings WMS", 
			"/geoserver/wms?SERVICE=WMS", 
			{layers: 'unimelb:structure_element_electricity', format:'image/png',transparent: true,tiled: true},
			{isBaseLayer: false, visibility: true, singleTile: true, ratio: 1.5}			
		);
		wms.transitionEffect = 'resize';

		map.addLayers([wfs,wms,basemap]);

		map.setCenter(
			new OpenLayers.LonLat(144.961, -37.800).transform(
				new OpenLayers.Projection("EPSG:4326"),
				map.getProjectionObject()
			), 16
		);

		selectCtrl = new OpenLayers.Control.SelectFeature(wfs,
		{
			clickout: true,
			onSelect: function(feature){
				origin="map";
				if (propagate)
				{
					var id_clicked = feature.data.id;
					comboStrEltByHierarchy.select(id_clicked);
					// It is necessary to trigger the select event
					comboStrEltByHierarchy.fireEvent('select',comboStrEltByHierarchy);
				}
			},
			onUnselect: function(feature){
				if (propagate)
				{
					comboStrEltByHierarchy.select();
					comboStrEltByHierarchy.fireEvent('select',comboStrEltByHierarchy);
				}
			}
		});
		map.addControl(selectCtrl);
		selectCtrl.activate();
		
	}
	
	init();

});