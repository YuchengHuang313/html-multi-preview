import assert from 'assert';
import sinon from 'sinon';
import { UpdateListener } from '../../updateListener';
import { AutoRefreshPreview, SettingUtil } from '../../utils/settingsUtil';
import { makeSetting } from './common';

describe('Never refresh policy', () => {
    let sandbox: sinon.SinonSandbox;
    let listener: UpdateListener;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { listener?.dispose(); sandbox.restore(); });

    it('blocks refresh requests from all listener entry points', () => {
        sandbox.stub(SettingUtil, 'GetConfig').returns(makeSetting({autoRefreshPreview: AutoRefreshPreview.never}));
        const clock = sandbox.useFakeTimers();
        listener = new UpdateListener(undefined);
        const refresh = sandbox.spy();
        listener.shouldRefreshPreviews(refresh);
        (listener as any)._refreshPreview();
        clock.tick(1000);
        assert.equal(refresh.callCount, 0);
    });

    it('cancels a pending refresh when Never becomes effective', () => {
        const settings = makeSetting({autoRefreshPreview: AutoRefreshPreview.onAnyChange});
        sandbox.stub(SettingUtil, 'GetConfig').callsFake(() => settings);
        const clock = sandbox.useFakeTimers();
        listener = new UpdateListener(undefined);
        const refresh = sandbox.spy();
        listener.shouldRefreshPreviews(refresh);
        (listener as any)._refreshPreview();
        settings.autoRefreshPreview = AutoRefreshPreview.never;
        clock.tick(1000);
        assert.equal(refresh.callCount, 0);
        settings.autoRefreshPreview = AutoRefreshPreview.onAnyChange;
        (listener as any)._refreshPreview();
        clock.tick(1000);
        assert.equal(refresh.callCount, 1, 'opt-in automatic refresh still works');
    });
});
