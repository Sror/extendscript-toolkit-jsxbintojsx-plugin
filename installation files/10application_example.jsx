/**************************************************************************
*
*  @@@BUILDINFO@@@ 10application-2.jsx 3.5.0.46	07-December-2009
*  ADOBE SYSTEMS INCORPORATED
*  Copyright 2010 Adobe Systems Incorporated
*  All Rights Reserved.
* 
* NOTICE:  Adobe permits you to use,  modify, and  distribute this file in
* accordance with the terms of the Adobe license agreement accompanying it.
* If you have received this file from a source other than Adobe, then your
* use, modification, or distribution of it requires the prior written
* permission of Adobe.
*
**************************************************************************/

// The current folder to use for open/save dialogs
app.currentFolder = Folder.myDocuments.absoluteURI;
// file watches
app.fileWatches = [];

app.onNotify = function( reason, shift )
{
    switch( reason )
    {
	    case 'shutdown':
	    {
	        globalBroadcaster.unregisterClient( this );
    	    
	        if( !arguments[1] )
		        this.writePrefs();
	    }
	    break;
	    
	    case 'preferencesDialog':
	    {
	        openPreferencesDialog( arguments[1] );
	    }
	    break;
	    
	    case 'reqNewDoc':
	    {
	        docMgr.create();
	    }
	    break;
	    
	    case 'reqOpenDoc':
	    {
	        app.open();
	    }
	    break;
		
		case 'appFrameChanged':
		{
			if( !_win )
			{
				if( workspace.appbar.btn )
					workspace.appbar.btn.update();
			}
		}
		break;
	}
}

app.onIdle = function()
{
	globalBroadcaster.notifyClients( 'IDLE' );
}

app.open = function()
{
	var f = File (this.currentFolder);
	var filetypes = lang.buildFileTypes();
	filetypes = filetypes.replace("*.jsx;", "*.jsx;*.jsxbin;");
	var files = f.openDlg (localize ("$$$/ESToolkit/FileDlg/Open=Open"),
						     filetypes, true);
	if (files)
	{
	    if( files.length > 1 )
	    {
            docMgr.showProgress (true);	
            docMgr.setProgress( 0, files.length );
        }
            
		for (var i = 0; i < files.length; i++)
		{
			f = files [i];

	        docMgr.setProgressText( f.name );
	        docMgr.incProgress(1);
		        
			// remember the folder
			this.currentFolder = f.parent ? f.parent.absoluteURI : "/";
			// resolve any alias
			if (f.alias)
			{
				var resolved = f.resolve();
				if (!resolved)
				{
					errorBox( localize( "$$$/ESToolkit/FileDlg/CannotResolve=Cannot resolve alias to file %1", decodeURIComponent( f.name ) ) );
					return false;
				}
				f = resolved;
			}

			f = app.convertJsxbinToJsx(f);

			// user selected a file; test if the file has been loaded
			var doc = docMgr.find( f.absoluteURI );
			
			if (doc)
				doc.activate();
			else if (!docMgr.load( f ))
			{
			    docMgr.showProgress( false );
			        
				return false;
			}
		}
		
		docMgr.showProgress( false );
	}
	return true;
}

app.loadPrefs = function()
{
    if( prefs.app.currentFolder.hasValue( Preference.STRING ) != '' )
    	this.currentFolder = prefs.app.currentFolder.getValue( Preference.STRING );

    if( prefs.app.scriptsFolder.hasValue( Preference.STRING ) != '' )
    	this.scriptsFolder = prefs.app.scriptsFolder.getValue( Preference.STRING );
    if( !this.scriptsFolder.exists )    	
        this.scriptsFolder = Folder.current.absoluteURI;
}

app.writePrefs = function()
{
	prefs.app.currentFolder = this.currentFolder;
}

app.toFront = function()
{
    //
	// ask the target to bring myself to front
	//
	var currTarget = targetMgr.getActiveTarget();
	
	if( currTarget && currTarget.getFeature( Feature.TO_FRONT ) )
	{
	    try
	    {
	        var job     = currTarget.cdic.toFront( currTarget.address );
	        job.hostID  = app.id;
	        
	        job.onResult = function()
	        {
	            if( !this.result[0] )
	                // try it by myself
	                app.bringToFront();
	        }
	        
	        job.onError = job.onTimeout = function()
	        {
	            // try it by myself
	            app.bringToFront();
	        }
	        
	        job.submit();
	    }
	    catch( exc )
	    {}
	}
	else
	    // try it by myself
	    app.bringToFront();
}

app.targetAppRunning = function( target )
{
    var ret = false;
    
    if( target.cdic )
    {
        try
        {
            var res = cdicMgr.callSynchronous( target.cdic.isTargetRunning( target.address ) );

            //
            // first res entry is the actuall result array, if there're more entries
            // then an error or a timeout occurred
            //
            if( res.length <= 1 )
                ret = res[0][0];
        }
        catch( exc )
        {
        // TODO
        }
    }
    
    return ret;
}

app.launchTargetAppSynchronous = function( target, launchMsg, connectIfLaunched )
{
    var ret = false;
    var finished = false;
    
    function check( state )
    {
        ret = state;
        finished = true;
    }
    
    var cb = new Callback( check );
    
    app.launchTargetApp( target, launchMsg, cb );
    
    while( !finished )
        cdi.pump();

	if( ret && connectIfLaunched && target )
		target.connect( true, undefined, undefined, true );

    return ret;
}

app.launchTargetApp = function( target, launchMsg, callback, errorInfo )
{
    //
	// OK if the target is myself or running
	//
	if( target.address.target == 'estoolkit-4.0' )
	{
	    if( callback )
	        callback.call( true );
    }
    
	if( !launchMsg )
		launchMsg = "$$$/ESToolkit/Alerts/Launch=Target %1 is not running.^nDo you want to launch %1?";
		
	if( !dsaQueryBox( 'app2', launchMsg, target.getTitle() ) )
	{
	    if( callback )
	        callback.call( false );
	        
	    return;
	}
		
    //
    // initiate launch
    //
    if( target.cdic )
    {
        try
        {
            var job         = target.cdic.launchTarget( target.address );
            job.target      = target;
            job.cb          = callback;
            job.errorInfo   = errorInfo;
            
            job.onResult = function()
            {
                if( this.result[0] )
                {
                    //
                    // target app is about to launch, now wait until the app finished launching
                    //
                    //                
                    // display a non-modal dialog
                    //
                    var dlg = new Window (
	                     "palette {															\
		                    properties: { closeOnKey:'Escape' },								\
		                    text: '" + app.title + "',												\
		                    orientation:'column',													\
		                    msg:   StaticText { text:'$$$/ESToolkit/Status/Sleeping=Waiting; press ESC to abort...' },\
		                    cancelBtn: Button { text:'$$$/CT/ExtendScript/UI/Cancel=&Cancel', properties:{name:'cancel'} }			\
		                    }																		\
	                     }");

                    dlg.cancel.onClick = function()
                    {
	                    //this.parent.aborted = true;
	                    this.parent.close();
                    }

                    dlg.onClose = function()
                    {
	                    this.aborted = true;
                    }

                    dlg.aborted = false;
                    dlg.toClose = false;
                    dlg.center();
                    dlg.show();

                    //
                    // wait until launched, timeout after 5 Min.
                    //
					const kLaunchTimeout = 300000; // 5 min.
					var startTime = new Date();

                    while( !dlg.aborted && !dlg.toClose )
                    {
                        try
                        {
                            var task = this.target.cdic.isTargetRunning( this.target.address );
							var res = CDICManager.getSynchronousResult( cdicMgr.callSynchronous( task ) );

							if( res && res.length && res[0] )
							{							
								// app is running
								dlg.toClose = true;
							}

							//
							// pump application event loop several times to
							// receive UI events
							//
                            var abortIm = false;

							for( var pumpLoop=0; pumpLoop<10 && !abortIm; pumpLoop++ )
								abortIm = !app.pumpEventLoop();
    	                    
                            if( abortIm )
                            {
                                // abort
	                            dlg.aborted = true;
	                            dlg.close();

                                if( abortIm )
                                {
                                    //
                                    // estk is quitting
                                    //
	                                return;
	                            }
                            }
                        }
                        catch( exc )
                        {
                            // abort
	                        dlg.aborted = true;
	                        dlg.close();
                        }

						var now = new Date();

						dlg.aborted = ( dlg.aborted ? dlg.aborted : ( ( now - startTime ) > kLaunchTimeout ) );
                    }

                    dlg.onClose = null;
                    dlg.close();
					var dlgaborted = dlg.aborted;
					dlg = null;		// force deletion of core Window element
                    
					if( this.cb )
						this.cb.call( !dlgaborted );
                }
                else
                {
                    app.launchError( this );
                }
            }
            
            job.onError = job.onTimeout = function()
            {
                app.launchError( this );
            }
            
            job.submit();
        }
        catch( exc )
        {
            if( this.cb )
                this.cb.call( false );
        }
    }
    else if( this.cb )
        this.cb.call( false );
}

app.launchError = function( targetOrJob )
{
    var target  = targetOrJob;
    var cb      = null;
    var error   = null;
    
    if( target.target )
    {
        //
        // parameter is a Job object
        //
        target = targetOrJob.target;
        cb     = targetOrJob.cb;
        error  = targetOrJob.errorInfo;
    }
    
    var errorMsg = localize( "$$$/ESToolkit/Alerts/CannotLaunch=Cannot launch target %1!", target.getTitle() );
    
    if( error )
        error.push( errorMsg );
    else   
	    new ErrorInfo( errorMsg ).display();
	
	if( cb )
	    cb.call( false );
}

///////////////////////////////////////////////////////////////////////////////
//
// file watches
//

app.onFilesChanged = function( files )
{
	for( var i=0; i<files.length; i++ )
	{
		for( var c=0; c<this.fileWatches.length; c++ )
		{
			if( this.fileWatches[c].file.absoluteURI == files[i].absoluteURI )
				this.fileWatches[c].client.onNotify( 'filechanged', files[i] );
		}
	}
}

app.addFileWatch = function( clientObj, file )
{
	if( clientObj && clientObj.onNotify )
	{
		for( var i=0; i<this.fileWatches.length; i++ )
			if( this.fileWatches[i].client == clientObj && this.fileWatches[i].file.absoluteURI == file.absoluteURI )
				return;
				
		this.fileWatches.push( { client : clientObj, file : file } );
		
		try
		{
			this.addFileToWatchList( file );
		}
		catch( exc )
		{}
	}
}

app.removeFileWatch = function( clientObj, file )
{
	for( var i=0; i<this.fileWatches.length; i++ )
	{
		if( this.fileWatches[i].client == clientObj && this.fileWatches[i].file.absoluteURI == file.absoluteURI )
		{
			this.fileWatches.splice(i,1);
			this.removeFileFromWatchList( file );
			break;
		}
	}
}

app.clearConsole = function( )
{
	if( app.modalState ) 
		return;

	if( console)
	{
		workspace.resetFocus();
		console.clear();
	}

	return "";
}

///////////////////////////////////////////////////////////////////////////////
//
// Busy animations
//

var __busyID__ = 0;
var __busyPlaceholder__ = {};
var __busyTick__ = 85;

app.startBusyFor = function( busyID, noRef )
{
    if( busyID instanceof Array )
    {
        for( var i=0; i<busyID.length; i++ )
            app.startBusyFor( busyID[i], noRef );
    }
    else
    {
        var imgObj = __busyPlaceholder__[busyID];

		try
		{
			if( imgObj && imgObj.icons )
			{
				if( !noRef || imgObj.instance <= 0 )
					imgObj.instance++;
	            
				if( imgObj.timer == -1 )
				{
					imgObj.icon      = imgObj.icons[0];
					imgObj.visible   = true;
					imgObj.timer     = app.scheduleTask( 'app.__busystep__(' + busyID + ');', __busyTick__, true );
				}
			}
		}
		catch( exc )
		{
			delete __busyPlaceholder__[busyID];
		}
    }
}

app.stopBusyFor = function( busyID )
{
    if( busyID instanceof Array )
    {
        for( var i=0; i<busyID.length; i++ )
            app.stopBusyFor( busyID[i] );
    }
    else
    {
        var imgObj = __busyPlaceholder__[busyID];
        
		try
		{
			if( imgObj )
			{
				imgObj.instance--;
	            
				if( imgObj.instance <= 0 )
				{
					if( imgObj.timer != -1 )
						app.cancelTask( imgObj.timer );
	                
					imgObj.visible     = false;
					imgObj.timer       = -1;
					imgObj.currentIdx  = 0;
					imgObj.instance    = 0;
				}
			}
		}
		catch( exc )
		{
			delete __busyPlaceholder__[busyID];
		}
    }
}

app.isBusy = function( busyID )
{
    if( busyID instanceof Array )
    {
        for( var i=0; i<busyID.length; i++ )
        {
            if( app.isBusy( busyID[i] ) )
                return true;
        }
        
        return false;
    }
    else
    {
        var ret = false;
        
        var imgObj = __busyPlaceholder__[busyID];

		try
		{
			if( imgObj )
				ret = imgObj.instance > 0;
		}
		catch( exc )
		{
			delete __busyPlaceholder__[busyID];
		}
            
        return ret;        
    }
}

app.initBusyPlaceholderImage = function( imageObj )
{
    imageObj.visible     = false;
    imageObj.currentIdx  = 0;
    imageObj.timer       = -1;
    imageObj.icons       = new Array;
    imageObj.instance    = 0;

    for( var i=1; i<9; i++ )
        imageObj.icons.push( '#Busyan0' + i );
        
    __busyID__++;        
    __busyPlaceholder__[__busyID__] = imageObj;
    
    return __busyID__;
}

app.__busystep__ = function( id )
{
    var imgObj = __busyPlaceholder__[id];

	try
	{
		if( imgObj && imgObj.icons )
		{
			imgObj.currentIdx++;
	        
			if( imgObj.currentIdx > 8 )
				imgObj.currentIdx = 1;

			var nextImg = imgObj.icons[imgObj.currentIdx-1];        
			imgObj.icon = nextImg;
		}
	}
	catch( exc )
	{
		delete __busyPlaceholder__[busyID];
	}
}
